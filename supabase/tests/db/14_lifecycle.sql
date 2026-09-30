-- Housekeeping, maintenance, room blocks, the nightly roll and KPIs (ported from reference 14_lifecycle).
begin;

-- Housekeeping cycle.
do $$
declare v_task uuid; v_task2 uuid; v_r uuid;
begin
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('101'), null, null);
  perform public.check_out(v_r, null, null);
  perform t.admin();
  select id into v_task from public.hk_tasks where room_id = t.room('101') and type = 'turnover' and status = 'open';
  perform t.ok(v_task is not null, '[HK-001] check-out left a turnover task for housekeeping');
  perform t.login('hks');
  perform t.raises(format('select public.start_hk_task(%L)', v_task), 'E_INVALID|E_FORBIDDEN', '[HK-002] a task assigned to nobody cannot be started');
  perform public.assign_hk_task(v_task, t.id('att'));
  perform t.login('att');
  perform public.start_hk_task(v_task);
  perform t.eq((select status from public.hk_tasks where id = v_task), 'in_progress', '[HK-002] room shows cleaning');
  perform public.complete_hk_task(v_task, '[]'::jsonb, null);
  perform t.eq((select board_column from public.v_hk_board where id = v_task), 'waiting_inspection', '[HK-002] room waits for inspection');
  perform t.raises(format('select public.inspect_hk_task(%L, true, %L, null, null)', v_task, 'inspected'), 'E_FORBIDDEN|E_SOD', '[HK-004] a room attendant cannot inspect');
  perform t.login('fom');
  perform t.raises(format('select public.assign_hk_task(%L, %L)', v_task, t.id('att')), 'E_FORBIDDEN|E_INVALID', '[HK-002] a front office manager cannot assign housekeeping');
  perform t.login('hks');
  perform t.raises(format('select public.inspect_hk_task(%L, false, %L, null, null)', v_task, 'failed'), 'E_REQUIRED', '[HK-003] a failed inspection needs a reason');
  perform public.inspect_hk_task(v_task, false, 'failed', '["Bathroom not cleaned"]'::jsonb, 'Bathroom not cleaned');
  perform t.eq((select condition from public.rooms where id = t.room('101')), 'dirty', '[HK-003] a failed room goes back to dirty');
  perform t.eq((select status from public.hk_tasks where id = v_task), 'failed', '[HK-003] the task is in rework');
  perform t.ok(exists (select 1 from public.notifications where user_id = t.id('att') and entity_id = v_task), '[HK-003] the attendant is notified of the failed inspection');
  perform t.login('att');
  perform public.start_hk_task(v_task);
  perform public.complete_hk_task(v_task, '[]'::jsonb, null);
  perform t.login('hks');
  perform public.inspect_hk_task(v_task, true, 'inspected', null, null);
  perform t.ok((select condition in ('clean', 'inspected') from public.rooms where id = t.room('101')), '[HK-003] reworked room passes and is ready');
  -- a supervisor who cleaned a room cannot inspect it
  v_task2 := public.create_hk_task(t.room('102'), 'deep_clean', 'normal', t.id('hks'), null);
  perform public.start_hk_task(v_task2);
  perform public.complete_hk_task(v_task2, '[]'::jsonb, null);
  perform t.raises(format('select public.inspect_hk_task(%L, true, %L, null, null)', v_task2, 'inspected'), 'E_SOD', '[HK-004] the cleaner cannot inspect their own work');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('housekeeping', sqlerrm);
end $$;

-- Condition overrides.
do $$ begin
  perform t.login('fdo');
  perform t.raises(format('select public.set_room_condition(%L, %L, %L)', t.room('103'), 'dirty', 'x'), 'E_FORBIDDEN', '[ROOM-004] front desk cannot override condition');
  perform t.login('fom');
  perform t.raises(format('select public.set_room_condition(%L, %L, %L)', t.room('103'), 'dirty', ''), 'E_REQUIRED', '[ROOM-004] override needs a reason');
  perform public.set_room_condition(t.room('103'), 'dirty', 'Guest complaint');
  perform public.set_room_condition(t.room('103'), 'inspected', 'Checked it myself');
  perform t.admin();
  perform t.ok(exists (select 1 from public.audit_events where record_id = t.room('103')::text and coalesce(reason, '') ilike '%myself%'), '[ROOM-004] condition override is audited');
exception when others then perform t.admin(); perform t.crash('condition override', sqlerrm);
end $$;

-- Maintenance tickets and room blocks.
do $$
declare v_tk uuid; v_blk uuid; v_r uuid; d date := t.bdate() + 50; v_avail int;
begin
  perform t.login('mnt');
  v_tk := public.create_ticket(t.id('propA'), 'Leaking tap', 'Bathroom tap drips', t.room('201'), null, 'normal', null);
  perform t.raises(format('select public.start_ticket(%L)', v_tk), 'E_INVALID|E_FORBIDDEN', '[MNT-001] an unassigned ticket cannot be started');
  perform t.login('hks');
  perform public.assign_ticket(v_tk, t.id('mnt'));
  perform t.login('mnt');
  perform public.start_ticket(v_tk);
  perform t.raises(format('select public.wait_ticket(%L, %L)', v_tk, ''), 'E_REQUIRED', '[MNT-001] waiting needs a reason');
  perform public.wait_ticket(v_tk, 'Waiting for part');
  perform public.start_ticket(v_tk);
  v_blk := public.block_room_for_ticket(v_tk, 'out_of_order', d, d + 2, 'Tap replacement');
  perform t.eq((select status from public.room_blocks where id = v_blk), 'pending', '[ROOM-002] a block by maintenance waits for approval');
  perform t.login('fom');
  select min(available) into v_avail from public.get_availability(t.id('propA'), d, d + 2) where room_type_code = 'DLX';
  perform t.eq(v_avail, 1, '[ROOM-002] a requested block does not remove the room from sale');
  perform public.approve_room_block(v_blk);
  select min(available) into v_avail from public.get_availability(t.id('propA'), d, d + 2) where room_type_code = 'DLX';
  perform t.eq(v_avail, 0, '[ROOM-002] an approved block removes the room from sale on those nights');
  perform t.login('mnt');
  perform public.resolve_ticket(v_tk, 'Tap replaced');
  perform t.raises(format('select public.close_ticket(%L)', v_tk), 'E_SOD|E_FORBIDDEN', '[MNT-002] the person who resolved cannot close');
  perform t.login('hks');
  perform public.close_ticket(v_tk);
  perform t.eq((select status from public.room_blocks where id = v_blk), 'released', '[MNT-002] closing the ticket releases the block');
  perform t.login('fom');
  select min(available) into v_avail from public.get_availability(t.id('propA'), d, d + 2) where room_type_code = 'DLX';
  perform t.eq(v_avail, 1, '[MNT-002] the room is back on sale after the ticket closes');
  perform t.login('hks');
  v_tk := public.create_ticket(t.id('propA'), 'Door lock', null, t.room('201'), null, 'normal', t.id('mnt'));
  perform t.login('mnt');
  perform public.start_ticket(v_tk);
  v_blk := public.block_room_for_ticket(v_tk, 'out_of_order', d + 20, d + 21, 'Lock change');
  perform public.resolve_ticket(v_tk, 'Lock changed');
  perform t.login('hks');
  perform public.close_ticket(v_tk);
  perform t.eq((select status from public.room_blocks where id = v_blk), 'cancelled', '[MNT-002] a block still waiting for approval is cancelled when its ticket closes');

  -- a block cannot cover a night a guest is assigned
  perform t.login('fdo');
  v_r := t.book(t.id('g2'), d + 5, d + 6, t.id('dlx'), t.id('bar'));
  perform public.assign_room(v_r, t.room('201'));
  perform t.login('fom');
  perform t.raises(format('select public.request_room_block(%L, %L, %L, %L, %L, null)', t.room('201'), 'out_of_order', d + 5, d + 6, 'Paint'),
    'E_ROOM_TAKEN|E_OVERSOLD', '[ROOM-003] a block cannot cover a night a guest is assigned');
  v_blk := public.request_room_block(t.room('201'), 'out_of_service', d + 10, d + 11, 'Paint', null);
  perform t.eq((select status from public.room_blocks where id = v_blk), 'approved', '[ROOM-002] an approver''s own block is approved at once');
  perform public.release_room_block(v_blk, 'Done early');
  perform t.eq((select status from public.room_blocks where id = v_blk), 'released', '[ROOM-002] a block can be released');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('maintenance and blocks', sqlerrm);
end $$;

-- The nightly roll. Move hotel A back one day, put guests in house, then roll.
do $$
declare v_r uuid; v_s uuid; v_ns uuid; v_x uuid; v_y uuid; v_d0 date; j jsonb; v_f uuid; v_n int;
begin
  perform t.admin();
  perform t.set_bdate(t.id('propA'), t.bdate() - 1);
  v_d0 := t.bdate();
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), v_d0, v_d0 + 2, t.id('std'), t.id('bar'));   -- staying on
  perform public.check_in(v_r, t.reg(), t.room('101'), null, null);
  v_ns := t.book(t.id('g3'), v_d0, v_d0 + 1, t.id('std'), t.id('bar'));  -- never arrives
  -- Two guests who were due to leave today (the closing date) and are still in house at the roll:
  -- v_s in room 103 (free tonight) and v_x in room 201, which is promised to v_y tonight.
  perform t.admin(); perform t.set_bdate(t.id('propA'), v_d0 - 1); perform t.login('fdo');
  v_s := t.book(t.id('g2'), v_d0 - 1, v_d0, t.id('std'), t.id('bar'));
  perform public.check_in(v_s, t.reg(), t.room('103'), null, null);
  v_x := t.book(t.id('g3'), v_d0 - 1, v_d0, t.id('dlx'), t.id('bar'));
  perform public.check_in(v_x, t.reg(), t.room('201'), null, null);
  perform t.admin(); perform t.set_bdate(t.id('propA'), v_d0); perform t.login('fdo');
  v_y := t.book(t.id('g1'), v_d0, v_d0 + 1, t.id('dlx'), t.id('bar'));
  perform public.assign_room(v_y, t.room('201'));
  perform t.login('adminA');
  perform public.set_rollover_time(t.id('propA'), '00:00');
  j := public.run_due_rollovers_now();
  perform t.admin();
  perform t.eq(t.bdate(), v_d0 + 1, '[DAY-001] the business date advanced by one day');
  v_f := t.main_folio(v_r);
  select count(*) into v_n from public.folio_transactions ft where ft.folio_id = v_f and ft.charge_code_id = t.cc('ROOM');
  perform t.eq(v_n, 1, '[DAY-002] one room charge on the staying guest''s folio');
  perform t.eq(t.balance(v_f), 59125.0000, '[DAY-002] the night includes service charge and VAT');
  perform t.eq((select business_date from public.folio_transactions where folio_id = v_f and charge_code_id = t.cc('ROOM') limit 1), v_d0, '[FIN-014] the charge carries the business date it belongs to');
  perform t.eq((select status from public.reservations where id = v_ns), 'no_show', '[RES-007] the guest who did not arrive was marked no-show');
  perform t.ok(exists (select 1 from public.hk_tasks where room_id = t.room('101') and type = 'stayover' and business_date = v_d0 + 1), '[HK-005] a stayover task exists for the guest staying on');
  perform t.eq((select rooms_sold from public.daily_stats where property_id = t.id('propA') and business_date = v_d0), 2, '[RPT-001] daily stats: two rooms sold');
  perform t.eq((select room_revenue from public.daily_stats where property_id = t.id('propA') and business_date = v_d0), 100000.0000, '[RPT-001] daily stats: room revenue is net of tax');
  perform t.ok(exists (select 1 from public.business_date_log where property_id = t.id('propA') and from_date = v_d0 and status = 'success'), '[DAY-001] the roll is logged');
  perform t.eq((select departure_date from public.reservations where id = v_s), v_d0 + 1, '[DAY-003] a guest still in house after their departure day is extended by one night');
  perform t.eq((select count(*)::int from public.folio_transactions where folio_id = t.main_folio(v_s) and charge_code_id = t.cc('ROOM') and business_date = v_d0), 1, '[DAY-003] the overstay night was charged');
  perform t.eq((select departure_date from public.reservations where id = v_x), v_d0, '[DAY-003] an overstay into a room promised to another guest is not extended');
  perform t.ok(exists (select 1 from public.notifications where user_id = t.id('fom') and kind = 'overstay' and entity_id = v_x), '[DAY-003] managers are told about the overstay they must resolve');
  perform t.eq((select count(*)::int from public.folio_transactions where folio_id = t.main_folio(v_x) and charge_code_id = t.cc('ROOM') and business_date = v_d0), 0, '[DAY-003] and no night is charged for it until they decide');
  perform t.eq((select occupancy from public.v_kpi_daily where property_id = t.id('propA') and business_date = v_d0),
    round(2::numeric / (select count(*) from public.rooms where property_id = t.id('propA') and is_active), 4), '[RPT-001] occupancy is rooms sold over rooms available');
  perform t.eq((select adr from public.v_kpi_daily where property_id = t.id('propA') and business_date = v_d0), 50000.0000, '[RPT-001] ADR uses revenue net of tax');
  -- running again the same day posts nothing twice
  perform t.login('adminA');
  j := public.run_due_rollovers_now();
  perform t.admin();
  perform t.eq((select count(*)::int from public.folio_transactions where folio_id = v_f and charge_code_id = t.cc('ROOM')), 1, '[DAY-002] no night was posted twice');
exception when others then perform t.admin(); perform t.crash('nightly roll', sqlerrm);
end $$;

-- A hotel several days behind catches up, and stops at the right date.
do $$
declare v_today date; j jsonb;
begin
  perform t.admin();
  v_today := t.bdate();
  -- A date can only be rolled once (business_date_log_once), so start from a clean log like a new hotel.
  delete from public.business_date_log where property_id = t.id('propA');
  perform t.set_bdate(t.id('propA'), v_today - 3);
  perform t.login('adminA');
  perform public.set_rollover_time(t.id('propA'), '00:00');
  j := public.run_due_rollovers_now();
  perform t.admin();
  perform t.eq(t.bdate(), v_today, '[DAY-001] the scheduler rolled the lagging property forward and stopped at the correct date');
  perform t.eq((select count(*)::int from public.business_date_log where property_id = t.id('propA') and status = 'success' and from_date >= v_today - 3), 3, '[DAY-001] each roll is logged');
exception when others then perform t.admin(); perform t.crash('catch-up roll', sqlerrm);
end $$;

rollback;

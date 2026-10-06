-- Wave 2, item 3 (6 Oct 2026): tests for requirement rows that had no tagged test. No application change.
-- SET-003, SET-006, RPT-002, RPT-003, RPT-004, ADM-009, GST-006, RES-012, RES-013 (database side).
begin;

create function t.avail(p_date date) returns integer language sql stable security definer as $$
  select sellable from public.get_availability(t.id('propA'), p_date, p_date + 1) where room_type_id = t.id('std') $$;
create function t.ledger_balance(p_folio uuid) returns numeric language sql stable security definer as $$
  select coalesce((select sum(amount) from public.folio_transactions where folio_id = p_folio), 0)
       + coalesce((select sum(l.amount) from public.folio_tax_lines l join public.folio_transactions x on x.id = l.transaction_id
                   where x.folio_id = p_folio), 0) $$;
grant execute on function t.avail(date), t.ledger_balance(uuid) to authenticated;

-- Each section below uses its own rooms (the sections share one transaction).
do $$ begin
  perform t.login('adminA');
  perform public.save_room(t.id('propA'), null, n, t.id('std'), '3', true) from unnest(array['311','312','313','314','315']) n;
  perform t.admin();
end $$;

-- SET-003: room inventory per property; new rooms start ready and vacant and count; condition and occupancy are never
-- written by hand; a room can be retired (and brought back) but never deleted while in use.
do $$
declare v_before int; v_room uuid; v_r uuid;
begin
  perform t.login('adminA');
  v_before := t.avail(t.bdate() + 30);
  v_room := public.save_room(t.id('propA'), null, '301', t.id('std'), '3', true);
  perform t.admin();
  perform t.ok((select condition = 'clean' and not is_occupied and is_active from public.rooms where id = v_room), '[SET-003] a new room starts clean (ready) and vacant');
  perform t.login('adminA');
  perform t.eq(t.avail(t.bdate() + 30), v_before + 1, '[SET-003] and counts towards the rooms that can be sold');
  perform t.raises(format('update public.rooms set condition = %L where id = %L', 'dirty', v_room), 'permission denied', '[SET-003] condition cannot be written by hand');
  perform t.raises(format('update public.rooms set is_occupied = true where id = %L', v_room), 'permission denied', '[SET-003] nor occupancy');
  perform t.raises(format('delete from public.rooms where id = %L', v_room), 'permission denied', '[SET-003] the app can never delete a room');
  perform public.save_room(t.id('propA'), v_room, '301', t.id('std'), '3', false);
  perform t.eq(t.avail(t.bdate() + 30), v_before, '[SET-003] a retired room is no longer sold');
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform t.raises(format('select public.check_in(%L, %L::jsonb, %L, null, null)', v_r, t.reg(), v_room), 'E_ROOM_NOT_READY', '[SET-003] nor can anyone check into it');
  perform t.login('adminA');
  perform public.save_room(t.id('propA'), v_room, '301', t.id('std'), '3', true);
  perform t.eq(t.avail(t.bdate() + 30), v_before + 1, '[SET-003] a retired room can be brought back');
  perform t.login('fdo');
  perform public.check_in(v_r, t.reg(), v_room, null, null);
  perform t.admin();
  perform t.raises(format('delete from public.rooms where id = %L', v_room), 'foreign key|violates', '[SET-003] even the database owner cannot delete a room that has been used');
  perform t.login('fdo');
  perform t.raises(format('select public.save_room(%L, null, %L, %L, %L, true)', t.id('propA'), '302', t.id('std'), '3'), 'E_FORBIDDEN', '[SET-003] front desk cannot add rooms');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('SET-003', sqlerrm);
end $$;

-- SET-006: charge codes and payment methods belong to one property; only active ones of that property are accepted.
do $$
declare v_spa uuid; v_b_code uuid; v_b_pm uuid; v_r uuid; v_f uuid; v_n int;
begin
  perform t.login('acc');
  v_spa := public.save_charge_code(t.id('propA'), null, 'SPA', 'Spa treatment', 'service', true, true);
  perform t.ok(v_spa is not null, '[SET-006] the accountant adds a charge code to the property');
  perform t.login('fdo');
  perform t.raises(format('select public.save_charge_code(%L, null, %L, %L, %L, true, true)', t.id('propA'), 'GYM', 'Gym', 'service'), 'E_FORBIDDEN',
    '[SET-006] front desk cannot change charge codes');
  perform t.raises(format('select public.save_payment_method(%L, null, %L, %L, %L, true)', t.id('propA'), 'MOMO', 'Mobile money', 'other'), 'E_FORBIDDEN',
    '[SET-006] nor payment methods');
  perform t.login('adminB');
  v_b_code := public.save_charge_code(t.id('propB'), null, 'BAR', 'Bar', 'food', true, true);
  v_b_pm := public.save_payment_method(t.id('propB'), null, 'MOMO', 'Mobile money', 'other', true);
  perform t.eq((select count(*)::int from public.charge_codes where property_id = t.id('propA')), 0, '[SET-006] another hotel cannot see this hotel''s charge codes');
  perform t.eq((select count(*)::int from public.payment_methods where property_id = t.id('propA')), 0, '[SET-006] nor its payment methods');
  perform t.raises(format('select public.save_charge_code(%L, %L, %L, %L, %L, true, false)', t.id('propA'), v_spa, 'SPA', 'Spa', 'service'), 'E_FORBIDDEN',
    '[SET-006] nor change them');
  perform t.raises(format('select public.save_charge_code(%L, %L, %L, %L, %L, true, false)', t.id('propB'), v_spa, 'SPA', 'Spa', 'service'), 'E_NOT_FOUND',
    '[SET-006] not even through its own property');
  perform t.login('fdo');
  v_r := t.book(t.id('g2'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('311'), null, null);
  v_f := t.main_folio(v_r);
  perform t.raises(format('select public.post_charge(%L, %L, 1000, false, null, null, %L)', v_f, v_b_code, 'set006-1'), 'E_INVALID',
    '[SET-006] a charge code of another property is refused on this bill');
  perform t.raises(format('select public.post_payment(%L, %L, 1000, %L, false, null, null, %L)', v_f, v_b_pm, 'NGN', 'set006-2'), 'E_INVALID',
    '[SET-006] and so is a payment method of another property');
  perform t.lives(format('select public.post_charge(%L, %L, 1000, false, null, null, %L)', v_f, v_spa, 'set006-3'), '[SET-006] an active code of this property is accepted');
  perform t.login('acc');
  perform public.save_charge_code(t.id('propA'), v_spa, 'SPA', 'Spa treatment', 'service', true, false);
  perform public.save_payment_method(t.id('propA'), t.pm('TRANSFER'), 'TRANSFER', 'Bank transfer', 'transfer', false);
  perform t.login('fdo');
  perform t.raises(format('select public.post_charge(%L, %L, 1000, false, null, null, %L)', v_f, v_spa, 'set006-4'), 'E_INVALID',
    '[SET-006] a code switched off is refused');
  perform t.raises(format('select public.post_payment(%L, %L, 1000, %L, false, null, null, %L)', v_f, t.pm('TRANSFER'), 'NGN', 'set006-5'), 'E_INVALID',
    '[SET-006] and so is a payment method switched off');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('SET-006', sqlerrm);
end $$;

-- RPT-002: the arrivals, in-house, room board and housekeeping board views show the right rows for the business date,
-- and only rows of the user's own hotel and property.
do $$
declare v_today uuid; v_tomorrow uuid; v_cancelled uuid; v_in uuid; v_task uuid; v_p2 uuid; v_room2 uuid; v_rt2 uuid;
begin
  perform t.login('fdo');
  v_today := t.book(t.id('g1'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  v_tomorrow := t.book(t.id('g2'), t.bdate() + 1, t.bdate() + 2, t.id('std'), t.id('bar'));
  v_cancelled := t.book(t.id('g3'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform t.login('fom');
  perform public.cancel_reservation(v_cancelled, 'Changed plans');
  perform t.login('fdo');
  perform t.ok(exists (select 1 from public.v_arrivals where id = v_today), '[RPT-002] arrivals show today''s booking');
  perform t.ok(not exists (select 1 from public.v_arrivals where id = v_tomorrow), '[RPT-002] not tomorrow''s');
  perform t.ok(not exists (select 1 from public.v_arrivals where id = v_cancelled), '[RPT-002] and not a cancelled one');
  v_in := t.book(t.id('g3'), t.bdate(), t.bdate() + 3, t.id('std'), t.id('bar'));
  perform public.check_in(v_in, t.reg(), t.room('312'), null, null);
  perform t.ok(exists (select 1 from public.v_in_house where reservation_id = v_in and room_number = '312'), '[RPT-002] in house shows the checked-in guest and room');
  perform t.ok(not exists (select 1 from public.v_arrivals where id = v_in), '[RPT-002] who has left the arrivals list');
  perform t.ok((select current_reservation_id = v_in and is_occupied and current_guest_name is not null from public.v_room_board where id = t.room('312')),
    '[RPT-002] the room board shows the room occupied by that guest');
  perform public.assign_room(v_tomorrow, t.room('313'));
  perform t.eq((select next_reservation_id from public.v_room_board where id = t.room('313')), v_tomorrow, '[RPT-002] and the next arrival for a room');
  perform t.login('hks');
  v_task := public.create_hk_task(t.room('313'), 'deep_clean', 'normal', t.id('att'), null);
  perform t.eq((select board_column from public.v_hk_board where id = v_task), 'assigned', '[RPT-002] the housekeeping board shows the task in its column');

  -- Another hotel sees none of it.
  perform t.login('adminB');
  perform t.eq((select count(*)::int from public.v_arrivals where property_id = t.id('propA')), 0, '[RPT-002] another hotel sees none of the arrivals');
  perform t.eq((select count(*)::int from public.v_in_house where property_id = t.id('propA')), 0, '[RPT-002] nor in house');
  perform t.eq((select count(*)::int from public.v_room_board where property_id = t.id('propA')), 0, '[RPT-002] nor the room board');
  perform t.eq((select count(*)::int from public.v_hk_board where property_id = t.id('propA')), 0, '[RPT-002] nor the housekeeping board');

  -- A second property of the same hotel: staff of the first property do not see it.
  perform t.admin();
  update public.tenant_subscriptions set plan_code = 'pro' where tenant_id = t.id('tenantA');
  perform t.login('adminA');
  v_p2 := public.create_property('Sunrise Annex', 'Ibadan', 'Nigeria');
  v_rt2 := public.save_room_type(v_p2, null, 'STD', 'Standard', 2, 1, null, true);
  v_room2 := public.save_room(v_p2, null, 'A1', v_rt2, '1', true);
  perform t.ok(exists (select 1 from public.v_room_board where id = v_room2), '[RPT-002] the administrator sees the second property''s rooms');
  perform t.login('fdo');
  perform t.ok(not exists (select 1 from public.v_room_board where property_id = v_p2), '[RPT-002] front desk of the first property does not');
  perform t.admin();
  update public.tenant_subscriptions set plan_code = 'standard' where tenant_id = t.id('tenantA');
exception when others then perform t.admin(); perform t.crash('RPT-002', sqlerrm);
end $$;

-- RPT-003: every reported figure equals the ledger rows or operational records behind it.
do $$
declare v_r uuid; v_f uuid; d public.daily_stats; v_room_rev numeric; v_total_rev numeric; v_sold int; v_avail int; k record;
begin
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('314'), null, null);
  v_f := t.main_folio(v_r);
  perform public.post_charge(v_f, t.cc('REST'), 10000, false, 'Dinner', null, 'rpt003-rest');
  perform public.post_payment(v_f, t.pm('CASH'), 30000, 'NGN', false, null, 'R-1', 'rpt003-pay');
  perform t.login('adminA');
  perform public.post_room_charges(t.id('propA'), null);
  perform t.admin();
  perform app.compute_daily_stats(t.id('propA'), t.bdate());
  select * into d from public.daily_stats where property_id = t.id('propA') and business_date = t.bdate();
  select coalesce(sum(x.base_amount), 0) into v_room_rev from public.folio_transactions x join public.charge_codes c on c.id = x.charge_code_id
    where x.property_id = t.id('propA') and x.business_date = t.bdate() and c.category = 'room' and x.kind not in ('payment', 'refund');
  select coalesce(sum(x.base_amount), 0) into v_total_rev from public.folio_transactions x join public.charge_codes c on c.id = x.charge_code_id
    where x.property_id = t.id('propA') and x.business_date = t.bdate() and c.category <> 'tax' and x.kind not in ('payment', 'refund');
  perform t.eq(d.room_revenue, v_room_rev, '[RPT-003] room revenue equals the room charges in the ledger');
  perform t.ok(v_room_rev >= 50000, '[RPT-003] and includes tonight''s room charge (50,000)');
  perform t.eq(d.total_revenue, v_total_rev, '[RPT-003] total revenue equals all charges in the ledger, before tax');
  perform t.eq(d.total_revenue - d.room_revenue >= 10000, true, '[RPT-003] which includes the dinner (10,000, tax kept apart)');
  select count(*) into v_sold from public.reservation_nights n join public.reservations r on r.id = n.reservation_id
    where n.property_id = t.id('propA') and n.stay_date = t.bdate() and r.status in ('checked_in', 'checked_out');
  select count(*) into v_avail from public.rooms where property_id = t.id('propA') and is_active;
  perform t.eq(d.rooms_sold, v_sold, '[RPT-003] rooms sold equals the nights of guests who stayed');
  perform t.eq(d.rooms_available, v_avail, '[RPT-003] rooms available equals the active rooms (none blocked)');
  select * into k from public.v_kpi_daily where property_id = t.id('propA') and business_date = t.bdate();
  perform t.eq(k.occupancy, round(v_sold::numeric / v_avail, 4), '[RPT-003] occupancy is rooms sold divided by rooms available');
  perform t.eq(k.adr, round(v_room_rev / nullif(v_sold, 0), 2), '[RPT-003] average rate is room revenue divided by rooms sold');
  perform t.eq(k.revpar, round(v_room_rev / v_avail, 2), '[RPT-003] revenue per available room is room revenue divided by rooms available');
  perform t.login('acc');
  perform t.eq((select balance from public.report_outstanding_balances(t.id('propA')) where folio_id = v_f), t.ledger_balance(v_f),
    '[RPT-003] the outstanding balance of a bill equals its ledger rows plus their tax');
  perform t.eq((select sum(balance) from public.report_outstanding_balances(t.id('propA'))),
    (select sum(t.ledger_balance(f.id)) from public.folios f where f.property_id = t.id('propA') and t.ledger_balance(f.id) <> 0),
    '[RPT-003] and the total outstanding equals the ledger for every open bill');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('RPT-003', sqlerrm);
end $$;

-- RPT-004: each report returns figures that match the source data, respects permissions and property access, and
-- handles an empty period.
do $$
declare v_r uuid; v_f uuid; v_a uuid; v_b uuid; v_c uuid; v_d uuid; c record; l record; v_far date := t.bdate() + 300;
begin
  perform t.login('fdo');
  v_r := t.book(t.id('g2'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('315'), null, null);
  v_f := t.main_folio(v_r);
  perform public.post_charge(v_f, t.cc('REST'), 8000, false, 'Lunch', null, 'rpt004-rest');
  perform public.post_payment(v_f, t.pm('CASH'), 5000, 'NGN', false, null, null, 'rpt004-pay');
  -- Four future bookings in one window, one cancelled.
  v_a := t.book(t.id('g1'), t.bdate() + 40, t.bdate() + 42, t.id('std'), t.id('bar'));
  v_b := t.book(t.id('g2'), t.bdate() + 41, t.bdate() + 42, t.id('std'), t.id('bar'));
  v_c := t.book(t.id('g3'), t.bdate() + 42, t.bdate() + 45, t.id('std'), t.id('bar'));
  v_d := t.book(t.id('g1'), t.bdate() + 43, t.bdate() + 44, t.id('std'), t.id('bar'));
  perform t.login('fom');
  perform public.cancel_reservation(v_d, 'Plans changed');

  perform t.login('acc');
  perform t.eq((select net from public.report_revenue_by_charge_code(t.id('propA'), t.bdate(), t.bdate()) where charge_code = 'REST'),
    (select sum(base_amount) from public.folio_transactions x where x.property_id = t.id('propA') and x.business_date = t.bdate()
       and x.charge_code_id = t.cc('REST') and x.kind not in ('payment', 'refund')),
    '[RPT-004] revenue by charge code matches the ledger');
  perform t.eq((select sum(payments) from public.report_payments(t.id('propA'), t.bdate(), t.bdate())),
    (select -sum(base_amount) from public.folio_transactions x where x.property_id = t.id('propA') and x.business_date = t.bdate() and x.kind = 'payment'),
    '[RPT-004] payments match the ledger');
  perform t.eq((select sum(balance) from public.report_balances_by_guest(t.id('propA')) where guest_id = t.id('g2')),
    (select sum(t.ledger_balance(f.id)) from public.folios f join public.reservations r on r.id = f.reservation_id
       where f.property_id = t.id('propA') and f.guest_id = t.id('g2')),
    '[RPT-004] balances by guest match the ledger');
  select * into c from public.report_cancellation_rate(t.id('propA'), t.bdate() + 40, t.bdate() + 43);
  perform t.ok(c.bookings = 4 and c.cancelled = 1 and c.cancellation_rate = 0.25 and c.no_shows = 0,
    '[RPT-004] cancellation rate: 1 of 4 bookings arriving in the window, 25%');
  select * into l from public.report_length_of_stay(t.id('propA'), t.bdate(), t.bdate());
  perform t.ok(l.stays >= 1 and l.average_nights = round((select avg(departure_date - arrival_date) from public.reservations
    where property_id = t.id('propA') and arrival_date = t.bdate() and status in ('checked_in', 'checked_out'))::numeric, 2),
    '[RPT-004] average length of stay matches the bookings that stayed');

  -- An empty period gives empty or zero figures, never an error.
  perform t.eq((select count(*)::int from public.report_revenue_by_charge_code(t.id('propA'), v_far, v_far + 5)), 0, '[RPT-004] an empty period has no revenue rows');
  perform t.eq((select count(*)::int from public.report_payments(t.id('propA'), v_far, v_far + 5)), 0, '[RPT-004] and no payment rows');
  select * into c from public.report_cancellation_rate(t.id('propA'), v_far, v_far + 5);
  perform t.ok(c.bookings = 0 and c.cancellation_rate is null, '[RPT-004] and no cancellation rate (not a division error)');
  select * into l from public.report_length_of_stay(t.id('propA'), v_far, v_far + 5);
  perform t.ok(l.stays = 0 and l.average_nights is null, '[RPT-004] and no average stay');

  -- Permissions and property access.
  perform t.login('fdo');
  perform t.raises(format('select * from public.report_revenue_by_charge_code(%L, %L, %L)', t.id('propA'), t.bdate(), t.bdate()), 'E_FORBIDDEN',
    '[RPT-004] front desk cannot open the finance reports');
  perform t.raises(format('select * from public.report_cancellation_rate(%L, %L, %L)', t.id('propA'), t.bdate(), t.bdate()), 'E_FORBIDDEN',
    '[RPT-004] nor the operations reports');
  perform t.login('hks');
  perform t.lives(format('select * from public.report_cancellation_rate(%L, %L, %L)', t.id('propA'), t.bdate(), t.bdate()),
    '[RPT-004] the housekeeping supervisor may open the operations reports');
  perform t.raises(format('select * from public.report_outstanding_balances(%L)', t.id('propA')), 'E_FORBIDDEN', '[RPT-004] but not the finance reports');
  perform t.login('adminB');
  perform t.raises(format('select * from public.report_outstanding_balances(%L)', t.id('propA')), 'E_FORBIDDEN', '[RPT-004] another hotel cannot open this hotel''s reports');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('RPT-004', sqlerrm);
end $$;

-- ADM-009: authorised users export data; the export is audited; others are refused.
do $$
declare j jsonb; a public.audit_events;
begin
  perform t.login('acc');
  j := public.export_data('reservations', t.id('propA'), t.bdate() - 10, t.bdate() + 60);
  perform t.ok(jsonb_typeof(j) = 'array' and jsonb_array_length(j) >= 1, '[ADM-009] the accountant exports the bookings');
  perform t.admin();
  select * into a from public.audit_events where action = 'export' and actor_id = t.id('acc') order by created_at desc limit 1;
  perform t.ok(a.table_name = 'reservations' and (a.after->>'rows')::int = jsonb_array_length(j) and a.after->>'property_id' = t.id('propA')::text,
    '[ADM-009] the export is audited: who, what, which property and how many rows');
  perform t.login('fdo');
  perform t.raises(format('select public.export_data(%L, %L, %L, %L)', 'reservations', t.id('propA'), t.bdate(), t.bdate()), 'E_FORBIDDEN',
    '[ADM-009] front desk cannot export');
  perform t.login('adminB');
  perform t.raises(format('select public.export_data(%L, %L, %L, %L)', 'transactions', t.id('propA'), t.bdate(), t.bdate()), 'E_FORBIDDEN',
    '[ADM-009] another hotel cannot export this hotel''s data');
  perform t.login('acc');
  perform t.raises(format('select public.export_data(%L, %L, %L, %L)', 'transactions', t.id('propA'), t.bdate(), t.bdate() + 400), 'E_INVALID',
    '[ADM-009] at most one year at a time');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('ADM-009', sqlerrm);
end $$;

-- GST-006: feedback and complaints are saved with the guest and shown on the profile.
do $$
declare v_id uuid; j jsonb;
begin
  perform t.login('fdo');
  v_id := public.add_guest_feedback(t.id('g1'), 'complaint', 'Air conditioning was noisy');
  j := public.get_guest(t.id('g1'));
  perform t.ok(exists (select 1 from jsonb_array_elements(j->'feedback') x where x->>'id' = v_id::text and x->>'text' = 'Air conditioning was noisy'
    and x->>'category' = 'complaint'), '[GST-006] front desk logs a complaint and it shows on the guest''s profile');
  perform public.set_guest_feedback_status(v_id, 'resolved');
  perform t.eq((select status from public.guest_feedback where id = v_id), 'resolved', '[GST-006] and can mark it resolved');
  perform t.raises(format('select public.add_guest_feedback(%L, %L, %L)', t.id('g1'), 'complaint', ''), 'E_REQUIRED', '[GST-006] empty feedback is refused');
  perform t.login('att');
  perform t.raises(format('select public.add_guest_feedback(%L, %L, %L)', t.id('g1'), 'complaint', 'x'), 'E_FORBIDDEN', '[GST-006] a room attendant cannot log feedback');
  perform t.login('adminB');
  perform t.eq((select count(*)::int from public.guest_feedback where id = v_id), 0, '[GST-006] another hotel cannot see it');
  perform t.raises(format('select public.set_guest_feedback_status(%L, %L)', v_id, 'closed'), 'E_NOT_FOUND', '[GST-006] nor change it');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('GST-006', sqlerrm);
end $$;

-- RES-012 (database side): a group is one record; each of its bookings is a one-room reservation linked to it.
do $$
declare v_g uuid; v_a uuid; v_b uuid;
begin
  perform t.login('fdo');
  perform t.raises(format('select public.save_group_booking(%L, null, %L, %L, %L, null)', t.id('propA'), 'Choir trip', 'Ada', '0800'), 'E_FORBIDDEN',
    '[RES-012] front desk cannot create a group');
  perform t.login('rsv');
  v_g := public.save_group_booking(t.id('propA'), null, 'Choir trip', 'Ada Obi', '08030000000', null);
  perform t.raises(format('select public.save_group_booking(%L, null, %L, null, null, null)', t.id('propA'), ''), 'E_REQUIRED', '[RES-012] a group needs a name');
  v_a := public.create_reservation(t.id('propA'), 'res012-a', t.id('g1'), t.bdate() + 50, t.bdate() + 52, t.id('std'), t.id('bar'), 1, 0,
    'confirmed', 'direct', null, null, null, 'none', null, v_g, null, null);
  v_b := public.create_reservation(t.id('propA'), 'res012-b', t.id('g2'), t.bdate() + 50, t.bdate() + 52, t.id('std'), t.id('bar'), 1, 0,
    'confirmed', 'direct', null, null, null, 'none', null, v_g, null, null);
  perform t.eq((select count(*)::int from public.reservations where group_id = v_g), 2, '[RES-012] the reservation officer books two rooms for the group, each linked to it');
  perform public.assign_room(v_a, t.room('101'));
  perform public.assign_room(v_b, t.room('102'));
  perform t.eq((select count(distinct room_id)::int from public.room_assignments where reservation_id in (v_a, v_b) and is_active), 2,
    '[RES-012] each booking gets its own room');
  perform t.ok((select count(*) = 4 from public.reservation_nights where reservation_id in (v_a, v_b)), '[RES-012] and its own nights');
  perform t.admin();
  update public.group_bookings set status = 'cancelled' where id = v_g;
  perform t.login('rsv');
  perform t.raises(format('select public.create_reservation(%L, %L, %L, %L, %L, %L, %L, 1, 0, %L, %L, null, null, null, %L, null, %L, null, null)',
    t.id('propA'), 'res012-c', t.id('g3'), t.bdate() + 50, t.bdate() + 51, t.id('std'), t.id('bar'), 'confirmed', 'direct', 'none', v_g),
    'E_INVALID', '[RES-012] a cancelled group takes no new bookings');
  perform t.login('adminB');
  perform t.eq((select count(*)::int from public.group_bookings where id = v_g), 0, '[RES-012] another hotel cannot see the group');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('RES-012', sqlerrm);
end $$;

-- RES-013 (database side): extra guests and the arrival-ready flag, with the permission rules.
do $$
declare v_r uuid;
begin
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate() + 60, t.bdate() + 61, t.id('std'), t.id('bar'), null, 'confirmed', 2);
  perform public.set_reservation_guests(v_r, t.id('g1'), array[t.id('g2')]);
  perform public.set_arrival_ready(v_r, true);
  perform t.ok((select count(*) = 2 from public.reservation_guests where reservation_id = v_r), '[RES-013] front desk adds the second guest');
  perform t.ok((select arrival_ready and status = 'confirmed' from public.reservations where id = v_r), '[RES-013] and marks the arrival ready; the status stays confirmed');
  perform t.login('att');
  perform t.raises(format('select public.set_reservation_guests(%L, %L, %L::uuid[])', v_r, t.id('g1'), '{}'), 'E_FORBIDDEN|E_NOT_FOUND',
    '[RES-013] a room attendant cannot change the guests');
  perform t.raises(format('select public.set_arrival_ready(%L, false)', v_r), 'E_FORBIDDEN|E_NOT_FOUND', '[RES-013] nor the arrival-ready flag');
  perform t.login('adminB');
  perform t.raises(format('select public.set_arrival_ready(%L, false)', v_r), 'E_FORBIDDEN|E_NOT_FOUND', '[RES-013] nor can another hotel');
  perform t.admin();
  perform t.ok((select arrival_ready from public.reservations where id = v_r), '[RES-013] the flag is unchanged after the refusals');
exception when others then perform t.admin(); perform t.crash('RES-013', sqlerrm);
end $$;

rollback;

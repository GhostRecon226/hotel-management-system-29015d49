-- [DRY-001] One hotel day from booking to night roll, as the pilot dry run will do it.
-- Same database functions the screens call, with the same people: front desk, front office manager,
-- housekeeping supervisor and attendant, maintenance, accountant, general manager.
-- If any step here fails, fix it before the dry run on practice.
begin;

-- Morning: set-up, bookings, deposit.
do $$
declare v_a uuid; v_b uuid; v_c uuid; v_dup uuid; v_fc uuid; v_dep numeric; v_d0 date; v_s uuid; v_n int;
begin
  perform t.login('adminA');
  perform public.save_room(t.id('propA'), null, '301', t.id('std'), '3', true);
  perform public.save_room(t.id('propA'), null, '302', t.id('std'), '3', true);
  perform public.save_room(t.id('propA'), null, '303', t.id('std'), '3', true);
  perform public.save_room(t.id('propA'), null, '304', t.id('std'), '3', true);
  perform t.admin();
  -- Start one day before the real business date so the night roll in this test is due.
  perform t.set_bdate(t.id('propA'), t.bdate() - 1);
  v_d0 := t.bdate();

  perform t.login('fdo');
  v_s := public.open_cashier_shift(t.id('propA'), 5000, 'day-shift-fdo');
  perform t.ok(v_s is not null, '[DRY-001] 0.4 the cashier opens a shift with a float');

  -- 1.1 to 1.3 bookings
  v_a := t.book(t.id('g1'), v_d0, v_d0 + 2, t.id('std'), t.id('bar'), 'day-bk-a');
  perform t.eq((select status from public.reservations where id = v_a), 'confirmed', '[DRY-001] 1.1 Guest A is booked for two nights');
  perform t.eq(t.book(t.id('g1'), v_d0, v_d0 + 2, t.id('std'), t.id('bar'), 'day-bk-a'), v_a, '[DRY-001] 1.5 saving twice with the same key gives one booking');
  v_b := t.book(t.id('g2'), v_d0 + 1, v_d0 + 4, t.id('std'), t.id('bar'), 'day-bk-b');
  perform t.ok(v_b is not null, '[DRY-001] 1.2 Guest B is booked from tomorrow');
  v_c := t.book(t.id('g3'), v_d0, v_d0 + 1, t.id('std'), t.id('prepaid'), 'day-bk-c', 'confirmed', 1, 'deposit');
  perform t.ok(v_c is not null, '[DRY-001] 1.3 Guest C is booked on the deposit plan');
  perform t.put('res_a', v_a); perform t.put('res_b', v_b); perform t.put('res_c', v_c);

  -- 1.6 cancel and reinstate (front desk officers cannot cancel; the manager does)
  perform t.raises(format($q$select public.cancel_reservation(%L, 'Guest asked to cancel', false, null)$q$, v_b), 'E_FORBIDDEN', '[DRY-001] 1.6 a front desk officer cannot cancel a booking');
  perform t.login('fom');
  perform public.cancel_reservation(v_b, 'Guest asked to cancel', false, null);
  perform t.eq((select status from public.reservations where id = v_b), 'cancelled', '[DRY-001] 1.6 a booking can be cancelled');
  perform public.reinstate_reservation(v_b, 'Guest changed their mind');
  perform t.eq((select status from public.reservations where id = v_b), 'confirmed', '[DRY-001] 1.6 and reinstated');
  perform t.login('fdo');

  -- 2.2 deposit for Guest C, 2.3 the repeat is stopped
  perform t.raises(format('select public.check_in(%L, %L::jsonb, %L, null, null)', v_c, t.reg(), t.room('302')), 'E_DEPOSIT_REQUIRED', '[DRY-001] 2.2 a guest on a deposit plan cannot check in before paying');
  v_fc := public.open_main_folio(v_c);
  perform t.put('fol_c', v_fc);
  v_dep := 25000;
  perform public.post_payment(v_fc, t.pm('CASH'), v_dep, 'NGN', true, 'Deposit', null, 'day-dep-c');
  perform t.eq(public.post_payment(v_fc, t.pm('CASH'), v_dep, 'NGN', true, 'Deposit', null, 'day-dep-c'),
    (select id from public.folio_transactions where folio_id = v_fc and kind = 'payment' limit 1), '[DRY-001] 2.2 a retry of the same deposit returns the first one');
  perform t.raises(format($q$select public.post_payment(%L, %L, %s, 'NGN', true, 'Deposit again', null, 'day-dep-c2')$q$, v_fc, t.pm('CASH'), v_dep),
    'E_POSSIBLE_DUPLICATE', '[DRY-001] 2.3 the same payment typed again is stopped');
  perform t.eq((select count(*)::int from public.folio_transactions where folio_id = v_fc and kind = 'payment'), 1, '[DRY-001] 2.3 and only one deposit is on the folio');
  perform t.admin();
end $$;

-- Arrivals, walk-in, room move.
do $$
declare v_a uuid := t.id('res_a'); v_c uuid := t.id('res_c'); v_w uuid; v_g uuid;
begin
  perform t.login('fdo');
  perform public.check_in(v_a, t.reg(), t.room('301'), null, null);
  perform t.eq((select status from public.reservations where id = v_a), 'checked_in', '[DRY-001] 2.1 Guest A is checked in');
  perform public.check_in(v_c, t.reg(), t.room('302'), null, null);
  perform t.eq((select status from public.reservations where id = v_c), 'checked_in', '[DRY-001] 2.2 Guest C is checked in after the deposit');
  v_g := public.save_guest(null, 'Walk', 'Inn', '08030009999', null, 'NG', null, null);
  v_w := public.walk_in_check_in(t.id('propA'), 'day-walkin', v_g, t.bdate() + 1, t.id('std'), t.id('bar'), 1, 0, t.room('303'), t.reg(), null, null, null, null, null, null);
  perform t.put('res_w', v_w);
  perform t.eq((select status from public.reservations where id = v_w), 'checked_in', '[DRY-001] 2.4 a walk-in is checked in with a room and folio');
  perform t.ok(t.main_folio(v_w) is not null, '[DRY-001] 2.4 the walk-in has a folio');

  -- 2.5 move rooms
  perform public.move_room(v_a, t.room('304'), 'Guest asked for a quieter room', null, null);
  perform t.ok((select ra.room_id = t.room('304') from public.room_assignments ra where ra.reservation_id = v_a and ra.is_active), '[DRY-001] 2.5 Guest A moves to another room');
  perform t.raises(format($q$select public.move_room(%L, %L, 'Again', null, null)$q$, v_a, t.room('304')), 'E_INVALID|already', '[DRY-001] 2.5 moving to the same room is refused');
  perform t.admin();
end $$;

-- During the stay: charges, discount approvals, services, extension, maintenance.
do $$
declare v_a uuid := t.id('res_a'); v_f uuid; v_chg uuid; j jsonb; v_ap uuid; v_before numeric; v_svc uuid; v_tk uuid; v_blk uuid; v_n int;
begin
  perform t.login('fdo');
  v_f := t.main_folio(v_a);
  v_chg := public.post_charge(v_f, t.cc('REST'), 20000, false, 'Dinner', null, 'day-chg-1');
  perform t.eq(public.post_charge(v_f, t.cc('REST'), 20000, false, 'Dinner', null, 'day-chg-1'), v_chg, '[DRY-001] 3.1 a charge posted twice with one key lands once');

  -- 3.3 and 3.4 discount above the desk limit
  v_before := t.balance(v_f);
  j := public.apply_discount(v_chg, 15000, 'Cold food', 'day-disc');
  perform t.eq(j->>'status', 'pending', '[DRY-001] 3.3 a big discount waits for approval');
  perform t.eq(t.balance(v_f), v_before, '[DRY-001] 3.3 and changes nothing yet');
  v_ap := (j->>'approval_id')::uuid;
  perform t.raises(format($q$select public.decide_approval(%L, true, 'Fine')$q$, v_ap), 'E_FORBIDDEN|E_SOD', '[DRY-001] 3.4 the front desk cannot approve its own request');
  perform t.login('fom');
  perform public.decide_approval(v_ap, true, 'Agreed');
  perform t.eq(t.balance(v_f), v_before - 15000, '[DRY-001] 3.4 the manager approves and the balance drops');

  -- 3.5 service request that charges once
  perform t.login('fdo');
  v_svc := public.create_service_request(v_a, 'laundry', 'Three shirts', true, 4000, t.cc('LAUNDRY'), null);
  perform t.login('fom');
  perform t.raises(format('select public.assign_service_request(%L, %L)', v_svc, t.id('att')), 'E_INVALID', '[DRY-001] 3.5 a room attendant cannot be given a service request');
  perform public.assign_service_request(v_svc, t.id('fdo'));
  perform t.login('fdo');
  perform public.start_service_request(v_svc);
  perform public.complete_service_request(v_svc);
  perform t.admin();
  perform t.eq((select count(*)::int from public.folio_transactions where folio_id = v_f and idempotency_key = 'svc:' || v_svc), 1, '[DRY-001] 3.5 a chargeable request posts one charge when done');

  -- 3.6 extend stay
  perform t.login('fdo');
  perform public.extend_stay(v_a, (select departure_date from public.reservations where id = v_a) + 1, 'Guest wants one more night');
  perform t.ok((select departure_date = t.bdate() + 3 from public.reservations where id = v_a), '[DRY-001] 3.6 the stay is extended by a night');
  perform t.raises(format($q$select public.extend_stay(%L, %L, 'Again')$q$, v_a, (select departure_date from public.reservations where id = v_a)), 'E_INVALID|Choose a departure', '[DRY-001] 3.6 the same departure again is refused');

  -- 3.7 maintenance: raise, assign, start, resolve; the same person cannot close; block leaves availability
  perform t.login('fom');
  v_tk := public.create_ticket(t.id('propA'), 'Air conditioner noisy', 'Rattles at night', t.room('303'), null, 'normal', t.id('mnt'));
  perform t.login('mnt');
  perform public.start_ticket(v_tk);
  v_blk := public.block_room_for_ticket(v_tk, 'out_of_order', t.bdate() + 5, t.bdate() + 6, 'Replace fan');
  perform public.resolve_ticket(v_tk, 'Fan replaced');
  perform t.raises(format('select public.close_ticket(%L)', v_tk), 'E_SOD|E_FORBIDDEN', '[DRY-001] 3.7 the person who fixed it cannot close it');
  perform t.login('fom');
  perform public.close_ticket(v_tk);
  perform t.eq((select status from public.maintenance_tickets where id = v_tk), 'closed', '[DRY-001] 3.7 a different person closes the ticket');
  perform t.admin();
end $$;

-- The night: the roll posts room charges and opens the next day.
do $$
declare v_a uuid := t.id('res_a'); v_f uuid; v_d0 date := t.bdate(); j jsonb; v_n int; v_w uuid := t.id('res_w');
begin
  v_f := t.main_folio(v_a);
  -- 3.2 posting the night's room charges by hand, twice, charges once
  perform t.login('adminA');
  perform public.post_room_charges(t.id('propA'), v_d0);
  perform public.post_room_charges(t.id('propA'), v_d0);
  perform t.admin();
  perform t.eq((select count(*)::int from public.folio_transactions where folio_id = v_f and charge_code_id = t.cc('ROOM') and business_date = v_d0), 1, '[DRY-001] 3.2 posting room charges twice charges once');
  perform t.login('adminA');
  perform public.set_rollover_time(t.id('propA'), '00:00');
  j := public.run_due_rollovers_now();
  perform t.admin();
  perform t.eq(t.bdate(), v_d0 + 1, '[DRY-001] 7.1 the night roll opens the next business date');
  perform t.eq((select count(*)::int from public.folio_transactions where folio_id = v_f and charge_code_id = t.cc('ROOM') and business_date = v_d0), 1,
    '[DRY-001] 7.1 the room charge posted once for the night');
  perform t.eq((select count(*)::int from public.folio_transactions where folio_id = t.main_folio(v_w) and charge_code_id = t.cc('ROOM') and business_date = v_d0), 1,
    '[DRY-001] 7.1 the walk-in was charged too');
  perform t.ok(exists (select 1 from public.business_date_log where property_id = t.id('propA') and from_date = v_d0 and status = 'success'), '[DRY-001] 7.1 the roll is logged');
  perform t.ok(exists (select 1 from public.hk_tasks where room_id = t.room('304') and type = 'stayover' and business_date = v_d0 + 1), '[DRY-001] 7.1 a stayover clean is planned for the guest staying on');
end $$;

-- Next morning: check-outs, housekeeping turnover, inspection.
do $$
declare v_c uuid := t.id('res_c'); v_fc uuid := t.id('fol_c'); v_task uuid; v_bal numeric; v_ap uuid; v_a uuid := t.id('res_a');
begin
  -- Guest C leaves owing money; the desk cannot close the bill, the manager can with a reason.
  perform t.login('fdo');
  perform public.post_check_out_charge(v_c);
  v_bal := t.balance(v_fc);
  perform t.ok(v_bal > 0, '[DRY-001] 5.1 Guest C still owes after the deposit');
  perform t.raises(format('select public.check_out(%L, null, null)', v_c), 'E_UNSETTLED|E_FORBIDDEN|E_INVALID|E_BALANCE', '[DRY-001] 5.1 the desk cannot check out a guest who owes');
  perform t.login('fom');
  perform public.check_out(v_c, null, 'Company will pay');
  perform t.eq((select status from public.reservations where id = v_c), 'checked_out', '[DRY-001] 5.2 the manager checks the guest out with a reason');

  -- Housekeeping turnover for Guest C's room.
  perform t.admin();
  select id into v_task from public.hk_tasks where room_id = t.room('302') and type = 'turnover' and status = 'open';
  perform t.ok(v_task is not null, '[DRY-001] 4.1 checkout opens a cleaning task');
  perform t.login('hks');
  perform public.assign_hk_task(v_task, t.id('att'));
  perform t.login('att');
  perform public.start_hk_task(v_task);
  perform public.complete_hk_task(v_task, '[]'::jsonb, null);
  perform t.raises(format($q$select public.inspect_hk_task(%L, true, 'inspected', '[]'::jsonb, null)$q$, v_task), 'E_FORBIDDEN|E_SOD', '[DRY-001] 4.3 the cleaner cannot inspect their own work');
  perform t.login('hks');
  perform public.inspect_hk_task(v_task, true, 'inspected', '[]'::jsonb, null);
  perform t.admin();
  perform t.eq((select condition from public.rooms where id = t.room('302')), 'inspected'::text, '[DRY-001] 4.4 a passed inspection leaves the room ready');
end $$;

-- Money, reports and who can see them.
do $$
declare v_c uuid := t.id('res_c'); v_fc uuid := t.id('fol_c'); l record; v_pay numeric; v_led numeric; j jsonb;
begin
  -- Collections picks up Guest C.
  perform t.login('acc');
  select * into l from public.collections_list(t.id('propA')) where reservation_id = v_c;
  perform t.ok(l.folio_id = v_fc and l.balance > 0, '[DRY-001] 8.1 Guest C is on the Collections list');
  perform public.add_collection_note(v_fc, 'called', 'Rang the company accounts office', null);
  select * into l from public.collections_list(t.id('propA')) where reservation_id = v_c;
  perform t.eq(l.notes_count, 1::bigint, '[DRY-001] 8.1 the follow-up is logged');

  -- Payments report equals the ledger for the money that moved today.
  select coalesce(sum(payments), 0) into v_pay from public.report_payments(t.id('propA'), t.bdate() - 5, t.bdate() + 5);
  perform t.admin();
  select coalesce(-sum(base_amount), 0) into v_led from public.folio_transactions ft
    join public.folios f on f.id = ft.folio_id join public.reservations r on r.id = f.reservation_id
   where r.property_id = t.id('propA') and app.is_money_movement(ft.kind, ft.payment_method_id) and ft.kind <> 'refund';
  perform t.eq(v_pay, v_led, '[DRY-001] 8.2 the Payments report matches the ledger');
  perform t.login('acc');
  perform t.ok(exists (select 1 from public.report_outstanding_balances(t.id('propA')) where folio_id = v_fc), '[DRY-001] 8.3 the outstanding balances report lists Guest C');
  perform t.admin();

  -- Dashboard figures for the general manager.
  perform t.login('gm');
  j := public.dashboard_summary(t.id('propA'));
  perform t.ok(j is not null and jsonb_typeof(j) = 'object', '[DRY-001] 8.4 the dashboard opens for the general manager');
  perform t.ok(jsonb_array_length(public.recent_activity(t.id('propA'), 8)) > 0, '[DRY-001] 8.4 and the Latest activity feed has items');

  -- Front desk sees no finance reports; housekeeping sees no money.
  perform t.login('fdo');
  perform t.raises(format('select * from public.report_payments(%L, current_date - 1, current_date)', t.id('propA')), 'E_FORBIDDEN', '[DRY-001] 8.5 the front desk cannot open finance reports');
  perform t.login('hks');
  perform t.raises(format('select * from public.collections_list(%L)', t.id('propA')), 'E_FORBIDDEN', '[DRY-001] 8.5 housekeeping cannot open Collections');
  perform t.admin();
end $$;

rollback;

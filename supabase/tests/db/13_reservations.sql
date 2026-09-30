-- Reservations, availability, fees, check-in, moves, extensions and check-out (ported from reference 13_reservations).
begin;

-- Extra standard rooms 104 to 112 for the front desk scenarios.
do $$ begin
  perform t.login('adminA');
  perform public.bulk_add_rooms(t.id('propA'), 104, 112, t.id('std'), '1');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('extra rooms', sqlerrm);
end $$;

-- Change dates on a booking, keeping everything else.
create function t.redate(p_res uuid, p_arrival date, p_departure date) returns void language plpgsql as $$
declare r public.reservations;
begin
  select * into r from public.reservations where id = p_res;
  perform public.modify_reservation(p_res, p_arrival, p_departure, r.room_type_id, r.rate_plan_id, r.adults, r.children, r.source,
    r.company_name, r.special_requests, r.notes, r.guarantee, r.hold_until, r.group_id, r.rate_override, r.override_reason);
end $$;
grant execute on function t.redate(uuid, date, date) to authenticated;

-- Availability and booking rules.
do $$
declare d date := t.bdate() + 60; v_a uuid; v_b uuid; n int;
begin
  perform t.login('fdo');
  -- 12 standard rooms: sell them all for d..d+2
  for n in 1..12 loop perform t.book(t.id('g1'), d, d + 2, t.id('std'), t.id('bar')); end loop;
  perform t.raises(format('select t.book(%L, %L, %L, %L, %L)', t.id('g2'), d, d + 2, t.id('std'), t.id('bar')), 'E_NO_AVAILABILITY|E_UNAVAILABLE', '[RES-003] a booking beyond the rooms available is refused');
  perform t.eq((select max(available) from public.get_availability(t.id('propA'), d, d + 2) where room_type_code = 'STD'), 0, '[RES-001] availability shows the type is full on both nights');
  perform t.lives(format('select t.book(%L, %L, %L, %L, %L)', t.id('g2'), d + 2, d + 3, t.id('std'), t.id('bar')), '[RES-001] the check-out day of other bookings is open for a new arrival');
  perform t.raises(format('select t.book(%L, %L, %L, %L, %L, null, %L, 5)', t.id('g2'), d + 10, d + 11, t.id('std'), t.id('bar'), 'confirmed'), 'E_INVALID|E_OCCUPANCY', '[RES-003] occupancy limit is enforced');
  perform t.raises(format('select t.book(%L, %L, %L, %L, %L)', t.id('g2'), t.bdate() - 1, t.bdate() + 1, t.id('std'), t.id('bar')), 'E_INVALID|E_DATES', '[RES-003] arrival in the past is refused');
  perform t.raises(format('select t.book(%L, %L, %L, %L, %L)', t.id('g2'), d + 10, d + 10, t.id('std'), t.id('bar')), 'E_INVALID|E_DATES|check constraint', '[RES-003] departure must be after arrival');
  v_a := t.book(t.id('g3'), d + 20, d + 22, t.id('std'), t.id('bar'), 'same-key');
  v_b := t.book(t.id('g3'), d + 20, d + 22, t.id('std'), t.id('bar'), 'same-key');
  perform t.eq(v_a, v_b, '[RES-002][NFR-003] the same idempotency key returns the same reservation');
  perform t.eq((select count(*)::int from public.reservation_nights where reservation_id = v_a), 2, '[RES-002] two nights');
  perform t.eq((select total_amount from public.reservations where id = v_a), 100000.0000, '[RES-002] two nights priced from the rate plan');
  perform t.raises(format('select public.create_reservation(%L, %L, %L, %L, %L, %L, %L, 1, 0, %L, %L, null, null, null, %L, null, null, 1000, %L)',
    t.id('propA'), gen_random_uuid(), t.id('g3'), d + 30, d + 31, t.id('std'), t.id('bar'), 'confirmed', 'direct', 'none', 'Friend'), 'E_FORBIDDEN', '[RES-009] front desk cannot override a rate');
  perform t.login('fom');
  v_a := public.create_reservation(t.id('propA'), gen_random_uuid()::text, t.id('g3'), d + 30, d + 31, t.id('std'), t.id('bar'), 1, 0, 'confirmed', 'direct',
    null, null, null, 'none', null, null, 1000, 'Friend of owner');
  perform t.eq((select total_amount from public.reservations where id = v_a), 1000.0000, '[RES-009] an authorised override sets the rate');
  perform t.raises(format('select public.create_reservation(%L, %L, %L, %L, %L, %L, %L, 1, 0, %L, %L, null, null, null, %L, null, null, 1000, %L)',
    t.id('propA'), gen_random_uuid(), t.id('g3'), d + 32, d + 33, t.id('std'), t.id('bar'), 'confirmed', 'direct', 'none', ''), 'E_REQUIRED', '[RES-009] an override needs a reason');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('availability', sqlerrm);
end $$;

-- Room assignment and modification.
do $$
declare d date := t.bdate() + 80; v_a uuid; v_b uuid; v_c uuid;
begin
  perform t.login('fdo');
  v_a := t.book(t.id('g1'), d, d + 3, t.id('std'), t.id('bar'));
  v_b := t.book(t.id('g2'), d + 1, d + 2, t.id('std'), t.id('bar'));
  perform public.assign_room(v_a, t.room('103'));
  perform t.raises(format('select public.assign_room(%L, %L)', v_b, t.room('103')), 'E_ROOM_TAKEN', '[FO-005] a room cannot be given to two overlapping stays');
  perform t.raises(format('select public.assign_room(%L, %L)', v_b, t.room('201')), 'E_INVALID|E_ROOM_TYPE', '[FO-005] room type must match the booking');
  perform t.redate(v_a, d, d + 2);
  perform t.eq((select total_amount from public.reservations where id = v_a), 100000.0000, '[RES-004] shortening the stay reprices it');
  perform t.eq((select count(*)::int from public.reservation_nights where reservation_id = v_a and stay_date = d + 2), 0, '[RES-004] the released night is gone');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('assignment', sqlerrm);
end $$;

-- Cancellation and no-show fees (finding M7).
do $$
declare v_early uuid; v_late uuid; v_ns uuid; v_w uuid; j jsonb; v_f uuid;
begin
  perform t.login('fom');
  v_early := t.book(t.id('g1'), t.bdate() + 10, t.bdate() + 12, t.id('std'), t.id('bar'));
  j := public.cancel_reservation(v_early, 'Plans changed', false, null);
  perform t.eq((j->>'charged')::numeric, 0::numeric, '[SET-004][RES-006] cancelling early is free');
  perform t.eq((select count(*)::int from public.folio_transactions ft join public.folios f on f.id = ft.folio_id where f.reservation_id = v_early), 0, '[RES-006] no fee rows for an early cancellation');
  perform t.raises(format('select public.cancel_reservation(%L, %L, false, null)', v_early, 'again'), 'E_INVALID', '[RES-006] a cancelled reservation cannot be cancelled again');
  perform t.raises(format('select public.cancel_reservation(%L, %L, false, null)', t.book(t.id('g1'), t.bdate() + 14, t.bdate() + 15, t.id('std'), t.id('bar')), ''), 'E_REQUIRED', '[RES-006] cancelling needs a reason');

  v_late := t.book(t.id('g2'), t.bdate() + 1, t.bdate() + 3, t.id('std'), t.id('bar'));
  j := public.cancel_reservation(v_late, 'Late change', false, null);
  perform t.eq((j->>'charged')::numeric, 50000::numeric, '[SET-004][RES-006] late cancellation costs one night');
  select f.id into v_f from public.folios f where f.reservation_id = v_late and f.is_main;
  perform t.eq(t.balance(v_f), 50000.0000, '[M7][RES-006] the cancellation fee is on the folio');

  perform t.login('rsv');
  v_w := t.book(t.id('g3'), t.bdate() + 1, t.bdate() + 2, t.id('std'), t.id('bar'));
  perform t.raises(format('select public.cancel_reservation(%L, %L, true, %L)', v_w, 'Guest ill', 'Goodwill'), 'E_FORBIDDEN', '[RES-006] a user without rate override cannot waive a fee');
  perform t.login('fom');
  j := public.cancel_reservation(v_w, 'Guest ill', true, 'Goodwill');
  perform t.eq((j->>'charged')::numeric, 0::numeric, '[RES-006] a manager can waive a fee');
  perform t.lives(format('select public.reinstate_reservation(%L, %L)', v_early, 'Guest is coming after all'), '[RES-008] manager reinstates a cancelled reservation');
  perform t.eq((select status from public.reservations where id = v_early), 'confirmed', '[RES-008] it is confirmed again');

  v_ns := t.book(t.id('g1'), t.bdate() + 3, t.bdate() + 4, t.id('std'), t.id('bar'));
  perform t.raises(format('select public.mark_no_show(%L, %L, false, null)', v_ns, 'x'), 'E_INVALID', '[RES-007] a guest who is not yet due cannot be a no-show');
  v_ns := t.book(t.id('g1'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  j := public.mark_no_show(v_ns, 'Did not arrive', false, null);
  perform t.eq((j->>'charged')::numeric, 50000::numeric, '[RES-007] no-show costs one night');
  perform t.eq((select status from public.reservations where id = v_ns), 'no_show', '[RES-007] reservation is marked no-show');
  select f.id into v_f from public.folios f where f.reservation_id = v_ns and f.is_main;
  perform t.eq(t.balance(v_f), 50000.0000, '[M7][RES-007] the no-show fee is on the folio');
  perform t.eq((select count(*)::int from public.folio_transactions where folio_id = v_f and kind = 'charge'), 1, '[M7][RES-007] the no-show fee is posted once');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('fees', sqlerrm);
end $$;

-- Check-in guards.
do $$
declare v_r uuid; v_dep uuid; v_n int;
begin
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  perform t.raises(format('select public.check_in(%L, %L::jsonb, %L, null, null)', v_r, '{}', t.room('104')), 'E_REQUIRED', '[FO-003] check-in needs an ID');
  perform t.raises(format('select public.check_in(%L, %L::jsonb, %L, null, null)', v_r, '{"id_type":"passport","id_number":"A1","registration_accepted":false}', t.room('104')),
    'E_REQUIRED|E_INVALID', '[FO-003] check-in needs the registration card accepted');
  perform t.raises(format('select public.check_in(%L, %L::jsonb, null, null, null)', v_r, t.reg()), 'E_REQUIRED|E_NO_ROOM', '[FO-003] check-in needs a room');
  perform t.login('fom');
  perform public.set_room_condition(t.room('105'), 'dirty', 'Spill');
  perform t.login('fdo');
  perform t.raises(format('select public.check_in(%L, %L::jsonb, %L, null, null)', v_r, t.reg(), t.room('105')), 'E_ROOM_NOT_READY', '[FO-003] a dirty room cannot be checked into');
  perform t.raises(format('select public.check_in(%L, %L::jsonb, %L, null, null)', t.book(t.id('g2'), t.bdate() + 1, t.bdate() + 2, t.id('std'), t.id('bar')), t.reg(), t.room('106')),
    'E_INVALID', '[FO-003] check-in before the arrival date is refused');
  perform public.check_in(v_r, t.reg(), t.room('104'), null, null);
  perform t.eq((select status from public.reservations where id = v_r), 'checked_in', '[FO-003] reservation is checked in');
  perform t.ok((select is_occupied from public.rooms where id = t.room('104')), '[FO-003] room becomes occupied');
  perform t.admin();
  perform t.eq((select count(*)::int from public.guest_documents where guest_id = t.id('g1') and doc_number = 'A1234567'), 1, '[GST-002] the ID was recorded once');
  perform t.ok((select coalesce(registration->>'id_number', '') = '' from public.stays where reservation_id = v_r), '[GST-002] the ID number is not copied into the stay record');
  perform t.login('fdo');
  perform t.eq(public.check_in(v_r, t.reg(), t.room('106'), null, null), (select id from public.stays where reservation_id = v_r and status = 'in_house'), '[FO-003] checking in twice returns the same stay');
  perform t.eq((select count(*)::int from public.stays where reservation_id = v_r), 1, '[FO-003] a guest cannot hold two stays');
  v_dep := t.book(t.id('g2'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('prepaid'), null, 'confirmed', 1, 'deposit');
  perform t.raises(format('select public.check_in(%L, %L::jsonb, %L, null, null)', v_dep, t.reg(), t.room('106')), 'E_DEPOSIT_REQUIRED', '[FO-003] a deposit guarantee must be paid before check-in');
  perform t.raises(format('select public.check_in(%L, %L::jsonb, %L, null, null)', v_dep, t.reg(), t.room('104')), 'E_ROOM_TAKEN|E_ROOM_NOT_READY|E_INVALID', '[FO-003] an occupied room cannot be checked into');
  perform public.post_payment(public.open_main_folio(v_dep), t.pm('CASH'), 25000, 'NGN', true, 'Deposit', null, 'dep-ci');
  perform t.lives(format('select public.check_in(%L, %L::jsonb, %L, null, null)', v_dep, t.reg(), t.room('106')), '[FO-003] deposit paid, guest checks in');
  v_r := public.walk_in_check_in(t.id('propA'), 'walkin-1', t.id('g3'), t.bdate() + 1, t.id('std'), t.id('bar'), 1, 0, t.room('107'), t.reg(), null, null, null, null, null, null);
  perform t.eq((select source from public.reservations where id = v_r), 'walk_in', '[FO-004] walk-in is recorded as a walk-in booking');
  perform t.eq((select status from public.reservations where id = v_r), 'checked_in', '[FO-004] and checked in in one step');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('check-in', sqlerrm);
end $$;

-- Room moves.
do $$
declare v_r uuid;
begin
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 3, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('108'), null, null);
  perform t.raises(format('select public.move_room(%L, %L, %L, null)', v_r, t.room('109'), ''), 'E_REQUIRED', '[FO-006] a move needs a reason');
  perform public.move_room(v_r, t.room('109'), 'Noisy air conditioner', null);
  perform t.ok((select is_occupied from public.rooms where id = t.room('109')), '[FO-006] new room is occupied');
  perform t.ok(not (select is_occupied from public.rooms where id = t.room('108')), '[FO-006] old room is vacant');
  perform t.eq((select condition from public.rooms where id = t.room('108')), 'dirty', '[FO-006] old room is dirty');
  perform t.ok(exists (select 1 from public.hk_tasks where room_id = t.room('108') and status not in ('cancelled')), '[FO-006][HK-001] a cleaning task was created for the old room');
  perform t.eq((select count(*)::int from public.stays where reservation_id = v_r and status = 'in_house'), 1, '[FO-006] one active room at a time');
  perform t.raises(format('select public.move_room(%L, %L, %L, null)', v_r, t.room('108'), 'Back'), 'E_ROOM_NOT_READY', '[FO-006] a dirty room is not a move target');
  perform t.ok(exists (select 1 from pg_proc where proname = 'move_room' and pg_get_function_arguments(oid) ~* 'complimentary|keep_rate'),
    '[FO-007] a complimentary upgrade that keeps the booked rate is supported');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('moves', sqlerrm);
end $$;

-- Extending and shortening in house.
do $$
declare v_a uuid; v_b uuid; v_tot numeric;
begin
  perform t.login('fdo');
  v_a := t.book(t.id('g2'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform public.check_in(v_a, t.reg(), t.room('110'), null, null);
  v_b := t.book(t.id('g3'), t.bdate() + 1, t.bdate() + 2, t.id('std'), t.id('bar'));
  perform public.assign_room(v_b, t.room('110'));
  perform t.raises(format('select public.extend_stay(%L, %L, %L)', v_a, t.bdate() + 2, 'Staying on'), 'E_ROOM_TAKEN', '[FO-008] a stay cannot extend into a room promised to another guest');
  perform public.unassign_room(v_b);
  v_tot := (select total_amount from public.reservations where id = v_a);
  perform public.extend_stay(v_a, t.bdate() + 3, 'Staying on');
  perform t.eq((select departure_date from public.reservations where id = v_a), t.bdate() + 3, '[FO-008] guest extended by two nights');
  perform t.eq((select total_amount from public.reservations where id = v_a), v_tot + 100000, '[FO-008] the extra nights are priced');
  perform t.lives(format('select public.extend_stay(%L, %L, %L)', v_a, t.bdate() + 2, 'Leaving earlier'), '[FO-008] an in-house stay can be shortened');
  perform t.eq((select count(*)::int from public.reservation_nights where reservation_id = v_a), 2, '[FO-008] shortening removes unused nights');
  perform t.raises(format('select public.extend_stay(%L, %L, %L)', v_a, t.bdate(), 'Now'), 'E_INVALID', '[FO-008] a stay cannot be shortened to today or earlier');
  perform t.raises(format('select t.redate(%L, %L, %L)', v_a, t.bdate(), t.bdate() + 5), 'E_INVALID', '[RES-004] an in-house reservation cannot be edited as a booking');
  perform t.put('res_ext', v_a);
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('extend', sqlerrm);
end $$;

-- Check-out, undo, credit and unsettled check-out (decision 5a).
do $$
declare v_r uuid; v_f uuid; j jsonb; v_ap uuid; v_inv uuid;
begin
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('111'), null, null);
  v_f := t.main_folio(v_r);
  perform public.post_charge(v_f, t.cc('REST'), 10000, false, 'Dinner', null, 'co-chg');
  perform t.raises(format('select public.check_out(%L, null, null)', v_r), 'E_BALANCE_DUE|E_REQUIRED|E_FORBIDDEN', '[FO-009] an unpaid balance blocks check-out');
  perform public.post_payment(v_f, t.pm('CASH'), 20000, 'NGN', false, null, null, 'co-pay');
  perform t.raises(format('select public.check_out(%L, null, null)', v_r), 'E_BALANCE_DUE|E_CREDIT|E_INVALID', '[FO-009] a credit balance blocks check-out until refunded');
  j := public.request_refund(v_f, t.pm('CASH'), 20000 - 11825, 'NGN', null, 'Change', 'co-ref');
  perform t.login('acc');
  perform public.decide_approval((j->>'approval_id')::uuid, true, 'ok');
  perform t.login('fdo');
  perform public.check_out(v_r, null, null);
  perform t.eq((select status from public.reservations where id = v_r), 'checked_out', '[FO-010] guest checked out');
  perform t.eq((select condition from public.rooms where id = t.room('111')), 'dirty', '[FO-010] room is dirty after check-out');
  perform t.ok(not (select is_occupied from public.rooms where id = t.room('111')), '[FO-010] room is vacant after check-out');
  perform t.ok(exists (select 1 from public.hk_tasks where room_id = t.room('111') and type = 'turnover' and status = 'open'), '[HK-001] housekeeping gets a turnover task');
  perform t.eq((select status from public.folios where id = v_f), 'closed', '[FO-010] a settled folio closes');
  perform t.eq(public.check_out(v_r, null, null), (select id from public.stays where reservation_id = v_r and status = 'checked_out'), '[FO-009] checking out twice returns the same stay');
  perform t.raises(format('select public.undo_checkout(%L, %L)', v_r, 'Mistake'), 'E_FORBIDDEN', '[FO-011] front desk cannot undo a check-out');
  perform t.login('fom');
  perform public.undo_checkout(v_r, 'Guest came back');
  perform t.eq((select status from public.reservations where id = v_r), 'checked_in', '[FO-011] check-out undone');
  perform t.ok((select is_occupied from public.rooms where id = t.room('111')), '[FO-011] room is occupied again');
  perform t.ok(not exists (select 1 from public.hk_tasks where room_id = t.room('111') and type = 'turnover' and status = 'open'), '[FO-011] the cleaning task was cancelled');
  perform t.eq((select status from public.folios where id = v_f), 'open', '[FO-011] folio reopened');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('check-out', sqlerrm);
end $$;

do $$
declare v_r uuid; v_f uuid; j jsonb; v_ap uuid; v_n int;
begin
  -- A guest who owes money. Front desk needs a second person; a holder of the approval permission can do it with a reason.
  perform t.login('fdo');
  v_r := t.book(t.id('g2'), t.bdate(), t.bdate() + 3, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('112'), null, null);
  v_f := t.main_folio(v_r);
  perform public.post_charge(v_f, t.cc('REST'), 10000, false, 'Dinner', null, 'un-chg');
  j := public.request_unsettled_checkout(v_r, 'Company will pay', 'un-req');
  v_ap := (j->>'approval_id')::uuid;
  perform t.raises(format('select public.check_out(%L, %L, null)', v_r, v_ap), 'E_NOT_APPROVED|E_INVALID', '[FO-009] a pending approval is not enough');
  perform t.raises(format('select public.decide_approval(%L, true, %L)', v_ap, 'ok'), 'E_FORBIDDEN|E_SOD', '[FO-009] front desk cannot approve the exception');
  perform t.login('fom');
  perform public.decide_approval(v_ap, true, 'Company account');
  perform t.login('fdo');
  perform public.check_out(v_r, v_ap, null);
  perform t.eq((select status from public.reservations where id = v_r), 'checked_out', '[FO-009] guest checked out with an approved exception');
  perform t.eq((select status from public.folios where id = v_f), 'open', '[FO-009] the folio stays open so the balance can be collected');
  perform t.ok((select count(*) from public.reservation_nights where reservation_id = v_r) <= 1, '[FO-010] leaving early releases the unused nights');
  perform t.put('res_unsettled', v_r); perform t.put('f_unsettled', v_f); perform t.put('ap_unsettled', v_ap);
  perform public.post_payment(v_f, t.pm('CASH'), t.balance(v_f), 'NGN', false, 'Company paid', null, 'un-late');
  perform t.eq(t.balance(v_f), 0.0000, '[FO-009] late payment settles the folio');

  -- Decision 5a: the approval-permission holder checks out a debtor alone, with a reason, and it is audited.
  v_r := t.book(t.id('g3'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('102'), null, null);
  perform public.post_charge(t.main_folio(v_r), t.cc('REST'), 5000, false, 'Lunch', null, 'un2-chg');
  perform t.login('fom');
  perform t.raises(format('select public.check_out(%L, null, %L)', v_r, ''), 'E_REQUIRED', '[FO-009][5a] an unpaid check-out needs a reason');
  perform public.check_out(v_r, null, 'Regular guest, pays monthly');
  perform t.admin();
  perform t.ok(exists (select 1 from public.audit_events where record_id in (v_r::text, (select id::text from public.stays where reservation_id = v_r))
    and coalesce(reason, '') ilike '%monthly%'), '[FO-009][5a] the unpaid check-out is in the audit trail with its reason');
exception when others then perform t.admin(); perform t.crash('unsettled check-out', sqlerrm);
end $$;

rollback;

-- Same-day stays (decision DAY-006, with D9): arrival and departure on the same day keeps the dates, has no
-- night rows, and is charged one night. A manager can waive the charge with a reason.
begin;

do $$
begin
  perform t.login('adminA');
  perform public.save_room(t.id('propA'), null, '150', t.id('std'), '1', true);
  perform public.save_room(t.id('propA'), null, '151', t.id('std'), '1', true);
  perform public.save_room(t.id('propA'), null, '152', t.id('std'), '1', true);
  perform t.admin();
end $$;

-- Booking
do $$
declare v_r uuid; v_before int; v_after int;
begin
  perform t.login('fdo');
  perform t.raises(format('select public.create_reservation(%L, %L, %L, %L, %L, %L, %L, 1, 0, %L, %L, null, null, null, %L, null, null, null, null)',
    t.id('propA'), 'sd-bad', t.id('g1'), t.bdate() + 5, t.bdate() + 4, t.id('std'), t.id('bar'), 'confirmed', 'direct', 'none'),
    'E_INVALID', '[DAY-006] departure before arrival is still refused');
  select reserved into v_before from public.get_availability(t.id('propA'), t.bdate() + 5, t.bdate() + 6) where room_type_id = t.id('std');
  v_r := t.book(t.id('g1'), t.bdate() + 5, t.bdate() + 5, t.id('std'), t.id('bar'));
  perform t.ok(v_r is not null, '[DAY-006] a same-day stay can be booked');
  perform t.eq((select departure_date - arrival_date from public.reservations where id = v_r), 0, '[DAY-006][D9] it keeps its dates (arrival = departure)');
  perform t.eq((select count(*)::int from public.reservation_nights where reservation_id = v_r), 0, '[D9] it has no night rows');
  perform t.eq((select total_amount from public.reservations where id = v_r), 50000.0000, '[DAY-006] its total is one night');
  select reserved into v_after from public.get_availability(t.id('propA'), t.bdate() + 5, t.bdate() + 6) where room_type_id = t.id('std');
  perform t.eq(v_after, v_before, '[D9] it does not use up a room for the night');
  perform t.eq((select count(*)::int from public.get_availability(t.id('propA'), t.bdate() + 5, t.bdate() + 5) where room_type_id = t.id('std')), 1,
    '[DAY-006] availability can be shown for a same-day stay');
  perform t.eq((public.preview_reservation_fee(v_r, 'no_show')->>'fee')::numeric, 50000::numeric, '[DAY-006] a same-day no-show costs one night, like any one-night stay');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('same-day booking', sqlerrm);
end $$;

-- Check-in charges one night; a manager can waive it with a reason; check-out.
do $$
declare v_r uuid; v_f uuid;
begin
  perform t.login('fdo');
  v_r := t.book(t.id('g2'), t.bdate(), t.bdate(), t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('150'), null, null);
  v_f := t.main_folio(v_r);
  perform t.eq(t.balance(v_f), 59125.0000, '[DAY-006] check-in posts one night with tax (50,000 + 18.25%)');
  perform t.eq((select count(*)::int from public.folio_transactions where folio_id = v_f and kind = 'charge'), 1, '[DAY-006] exactly one room charge');
  perform t.ok((select description ilike '%same-day%' from public.folio_transactions where folio_id = v_f and kind = 'charge'), '[DAY-006] labelled as a same-day stay');
  perform public.check_in(v_r, t.reg(), t.room('150'), null, null);
  perform t.eq((select count(*)::int from public.folio_transactions where folio_id = v_f and kind = 'charge'), 1, '[DAY-006] checking in again does not charge twice');
  perform t.raises(format('select public.waive_same_day_charge(%L, %L)', v_r, 'Regular guest'), 'E_FORBIDDEN', '[DAY-006] front desk cannot waive the charge');
  perform t.login('fom');
  perform t.raises(format('select public.waive_same_day_charge(%L, %L)', v_r, ' '), 'E_REQUIRED', '[DAY-006] waiving needs a reason');
  perform public.waive_same_day_charge(v_r, 'Room was only used for two hours');
  perform t.eq(t.balance(v_f), 0.0000, '[DAY-006] a manager waives it with a reason and the folio is back to zero');
  perform t.ok(exists (select 1 from public.audit_events a where a.table_name = 'reservations' and a.record_id = v_r::text
    and a.action = 'waive_same_day_charge' and a.reason = 'Room was only used for two hours'), '[DAY-006] the waiver and its reason are in the booking history');
  perform t.raises(format('select public.waive_same_day_charge(%L, %L)', v_r, 'Again'), 'E_INVALID|E_ALREADY_REVERSED', '[DAY-006] it can be waived only once');
  perform t.login('fdo');
  perform t.lives(format('select public.check_out(%L)', v_r), '[DAY-006] the guest checks out the same day');
  perform t.eq((select departure_date from public.reservations where id = v_r), t.bdate(), '[DAY-006] the departure date stays the same day');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('same-day stay', sqlerrm);
end $$;

-- Walk-in for the day, and voiding a same-day check-in.
do $$
declare v_r uuid;
begin
  perform t.login('fdo');
  v_r := public.walk_in_check_in(t.id('propA'), 'sd-walk', t.id('g3'), t.bdate(), t.id('std'), t.id('bar'), 1, 0, t.room('151'), t.reg(), null, null, null, null, null, null);
  perform t.eq(t.balance(t.main_folio(v_r)), 59125.0000, '[DAY-006] a same-day walk-in is charged one night');
  perform t.login('fom');
  perform public.void_check_in(v_r, 'Wrong guest');
  perform t.eq(t.balance(t.main_folio(v_r)), 0.0000, '[DAY-006] voiding the check-in removes the same-day charge');
  perform t.login('fdo');
  perform public.check_in(v_r, t.reg(), t.room('151'), null, null);
  perform t.eq(t.balance(t.main_folio(v_r)), 59125.0000, '[DAY-006] checking in again charges it again');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('same-day walk-in', sqlerrm);
end $$;

-- A same-day guest still in house at the roll is not charged the night twice.
do $$
declare v_r uuid; v_d date := t.bdate();
begin
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate(), t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('152'), null, null);
  perform t.admin();
  perform app.roll_property(t.id('propA'), 'manual', null);
  perform t.eq((select count(*)::int from public.folio_transactions where folio_id = t.main_folio(v_r) and kind = 'charge' and business_date = v_d), 1,
    '[DAY-006] the roll does not charge a second night for the same day');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('same-day roll', sqlerrm);
end $$;

rollback;

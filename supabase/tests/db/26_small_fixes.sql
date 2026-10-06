-- Wave 1, item 2 (6 Oct 2026): extra checks for the small fixes behind known failures in 13, 14 and 17.
begin;

do $$ begin
  perform t.login('adminA');
  perform public.save_room(t.id('propA'), null, n, t.id('std'), '1', true) from unnest(array['151','152','153']) n;
end $$;

-- FO-008: shortening keeps the room for the remaining nights and reprices the stay.
do $$
declare v_r uuid; v_tot numeric; v_f uuid; v_ledger text;
begin
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 4, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('151'), null, null);
  v_f := t.main_folio(v_r);
  perform public.post_payment(v_f, t.pm('CASH'), 10000, 'NGN', true, 'Deposit', null, 'shorten-dep');
  perform t.admin();
  v_ledger := (select string_agg(id::text || amount::text, ',' order by id) from public.folio_transactions where folio_id = v_f);
  perform t.login('fdo');
  v_tot := (select total_amount from public.reservations where id = v_r);
  perform public.extend_stay(v_r, t.bdate() + 2, 'Leaving early');
  perform t.admin();
  perform t.eq((select string_agg(id::text || amount::text, ',' order by id) from public.folio_transactions where folio_id = v_f), v_ledger,
    '[FO-008] shortening adds, changes and removes no ledger row');
  perform t.ok((select jsonb_array_length(before->'removed_nights') = 2 from public.audit_events where action = 'shorten_stay' and record_id = v_r::text),
    '[FO-008] the removed nights are kept in the audit log');
  perform t.login('fdo');
  perform t.eq((select departure_date from public.reservations where id = v_r), t.bdate() + 2, '[FO-008] the departure moves earlier');
  perform t.eq((select total_amount from public.reservations where id = v_r), v_tot / 2, '[FO-008] the stay is repriced for the remaining nights');
  perform t.eq((select max(to_date) from public.room_assignments where reservation_id = v_r and is_active), t.bdate() + 2, '[FO-008] the room is released from the new departure');
  perform t.raises(format('select public.extend_stay(%L, %L, %L)', v_r, t.bdate() + 2, 'Same'), 'E_INVALID', '[FO-008] the same departure is refused');
end $$;

-- HK-002: an attendant cannot start an unassigned task; the supervisor assigns it first.
do $$
declare v_t uuid;
begin
  perform t.login('hks');
  v_t := public.create_hk_task(t.room('152'), 'deep_clean', 'normal', null, null);
  perform t.login('att');
  perform t.raises(format('select public.start_hk_task(%L)', v_t), 'E_INVALID|E_FORBIDDEN', '[HK-002] an attendant cannot pick up an unassigned task');
  perform t.login('fdo');
  perform t.ok(exists (select 1 from public.v_hk_board where id = v_t), '[HK-002] front desk still sees every task');
end $$;

-- ROOM-004: every manual condition change needs a reason.
do $$ begin
  perform t.login('fom');
  perform t.raises(format('select public.set_room_condition(%L, %L, null)', t.room('152'), 'inspected'), 'E_REQUIRED', '[ROOM-004] a change with no reason is refused');
end $$;

-- PLT-004: country sets currency and time zone for a new hotel.
do $$
declare v_ke uuid := gen_random_uuid(); r record;
begin
  perform t.admin();
  insert into auth.users (id, email, email_confirmed_at, aud, role) values (v_ke, 'ke@test.local', now(), 'authenticated', 'authenticated');
  perform t.put('adminKE', v_ke);
  perform t.login('adminKE');
  select * into r from public.create_hotel('Nairobi Rest Ltd', 'Kenya', 'Nairobi Rest', 'Wanjiru Kamau', 'Nairobi');
  perform t.admin();
  perform t.eq((select base_currency::text from public.properties where id = r.property_id), 'KES', '[PLT-004] Kenya property uses shilling');
  perform t.eq((select timezone from public.properties where id = r.property_id), 'Africa/Nairobi', '[PLT-004] and the Nairobi time zone');
end $$;

-- RES-013: front desk can mark an arrival ready and not ready; it does not change the booking status.
do $$
declare v_r uuid;
begin
  perform t.login('fdo');
  v_r := t.book(t.id('g2'), t.bdate() + 6, t.bdate() + 7, t.id('std'), t.id('bar'));
  perform t.eq((select arrival_ready from public.reservations where id = v_r), false, '[RES-013] a new booking is not marked ready');
  perform public.set_arrival_ready(v_r, true);
  perform t.eq((select arrival_ready from public.reservations where id = v_r), true, '[RES-013] front desk marks it ready');
  perform t.eq((select status from public.reservations where id = v_r), 'confirmed', '[RES-013] the booking status is unchanged');
  perform t.login('hks');
  perform t.raises(format('select public.set_arrival_ready(%L, false)', v_r), 'E_FORBIDDEN', '[RES-013] housekeeping cannot change it');
end $$;

-- SET-008: with inspection switched off, a completed room is clean straight away.
do $$
declare v_t uuid;
begin
  perform t.login('fom');
  perform t.raises(format('select public.set_inspection_required(%L, false)', t.id('propA')), 'E_FORBIDDEN', '[SET-008] only someone who edits the property can switch it');
  perform t.login('adminA');
  perform public.set_inspection_required(t.id('propA'), false);
  perform t.login('hks');
  v_t := public.create_hk_task(t.room('153'), 'deep_clean', 'normal', t.id('att'), null);
  perform t.login('att');
  perform public.start_hk_task(v_t);
  perform public.complete_hk_task(v_t, '[]'::jsonb, null);
  perform t.admin();
  perform t.eq((select status from public.hk_tasks where id = v_t), 'inspected', '[SET-008] with inspection off, the task closes on completion');
  perform t.eq((select condition from public.rooms where id = t.room('153')), 'clean', '[SET-008] and the room is clean');
  perform t.login('adminA');
  perform public.set_inspection_required(t.id('propA'), true);
  perform t.admin();
  perform t.eq((select inspection_required from public.properties where id = t.id('propA')), true, '[SET-008] it can be switched back on');
end $$;

rollback;

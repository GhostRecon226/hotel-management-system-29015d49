-- FO-008 follow-up (6 Oct 2026). Shortening a stay already left the ledger alone (booking nights after the business
-- date are the plan for the stay, not posted charges). Now the removed nights are also kept in the audit log
-- (action shorten_stay, before.removed_nights), as check-out already does. Otherwise extend_stay is unchanged
-- from 20261009100000_small_test_fixes.sql.

create or replace function public.extend_stay(p_id uuid, p_new_departure date, p_reason text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; v_max int; d date; v_amt numeric; v_room uuid; v_rn text; v_bdate date;
begin
  r := app.reservation_for_write(p_id, 'fo.stay.extend');
  if r.status <> 'checked_in' then perform app.fail('E_INVALID', 'Only in-house stays can be extended or shortened.'); end if;
  if p_new_departure is null or p_new_departure = r.departure_date then
    perform app.fail('E_INVALID', 'Choose a departure date other than ' || to_char(r.departure_date, 'DD Mon YYYY') || '.'); end if;

  if p_new_departure < r.departure_date then
    -- Shorten: nights from the new departure on have not been charged yet (they are after the business date).
    select business_date into v_bdate from public.properties where id = r.property_id;
    if p_new_departure <= v_bdate then
      perform app.fail('E_INVALID', 'The new departure must be after ' || to_char(v_bdate, 'DD Mon YYYY') || '. To leave today, check the guest out.'); end if;
    -- Booking nights are the plan for the stay, not the ledger. Keep a copy of what is removed in the audit log.
    insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, before, after, reason)
    select r.tenant_id, auth.uid(), 'shorten_stay', 'reservations', p_id::text,
      jsonb_build_object('departure_date', r.departure_date, 'removed_nights', coalesce(jsonb_agg(to_jsonb(n) order by n.stay_date), '[]'::jsonb)),
      jsonb_build_object('departure_date', p_new_departure), nullif(btrim(p_reason), '')
    from public.reservation_nights n where n.reservation_id = p_id and n.stay_date >= p_new_departure;
    delete from public.reservation_nights where reservation_id = p_id and stay_date >= p_new_departure;
    update public.room_assignments set to_date = p_new_departure
    where reservation_id = p_id and is_active and to_date > p_new_departure and from_date < p_new_departure;
  else
    select max_stay_nights into v_max from public.properties where id = r.property_id;
    if p_new_departure - r.arrival_date > v_max then
      perform app.fail('E_INVALID', 'Stays can be at most ' || v_max || ' nights at this property.'); end if;
    perform app.assert_available(r.property_id, r.room_type_id, r.departure_date, p_new_departure, p_id);

    select a.room_id, rm.room_number into v_room, v_rn from public.room_assignments a join public.rooms rm on rm.id = a.room_id
    where a.reservation_id = p_id and a.is_active order by a.to_date desc limit 1;
    begin
      update public.room_assignments set to_date = p_new_departure
      where reservation_id = p_id and is_active and room_id = v_room;
    exception when exclusion_violation then
      perform app.fail('E_ROOM_TAKEN', 'Room ' || v_rn || ' is booked for another guest on those dates. Move the guest to another room first.');
    end;

    for d in select g::date from generate_series(r.departure_date, p_new_departure - 1, interval '1 day') g loop
      select p.amount into v_amt from public.rate_plan_prices p
      where p.rate_plan_id = r.rate_plan_id and p.room_type_id = r.room_type_id and d between p.valid_from and p.valid_to limit 1;
      if r.rate_override is not null then v_amt := r.rate_override; end if;
      if v_amt is null then
        perform app.fail('E_NO_RATE', 'No price is set for this rate plan and room type on ' || to_char(d, 'DD Mon YYYY') || '.'); end if;
      begin
        insert into public.reservation_nights(tenant_id, property_id, reservation_id, room_type_id, stay_date, rate_amount, room_id)
        values (r.tenant_id, r.property_id, p_id, r.room_type_id, d, v_amt, v_room);
      exception when unique_violation then
        perform app.fail('E_ROOM_TAKEN', 'Room ' || v_rn || ' is booked for another guest on those dates. Move the guest to another room first.');
      end;
    end loop;
  end if;

  perform set_config('app.audit_reason', coalesce(btrim(p_reason), ''), true);
  update public.reservations set departure_date = p_new_departure,
    total_amount = (select coalesce(sum(rate_amount), 0) from public.reservation_nights where reservation_id = p_id),
    updated_at = now()
  where id = p_id;
  perform set_config('app.audit_reason', '', true);
end $$;

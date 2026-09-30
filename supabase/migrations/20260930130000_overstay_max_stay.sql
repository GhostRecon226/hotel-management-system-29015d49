-- Overstays stop at the maximum stay length (follow-up to 20260930120400_roll_overstays).
--
-- Before: the roll extended an overstaying guest even past the property's maximum stay, which the
-- Extend button refuses.
-- After: at the limit the stay is not extended and managers are told why ("reached the maximum of N
-- nights"), like any other overstay the roll cannot extend.

create or replace function app.roll_overstays(p public.properties, p_date date)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare s record; r public.reservations; d date; v_amt numeric; v_room uuid; v_rn text; v_max int;
  v_extended int := 0; v_flagged int := 0; v_err text;
begin
  for s in
    select st.reservation_id, st.room_id from public.stays st
    join public.reservations x on x.id = st.reservation_id
    where st.property_id = p.id and st.status = 'in_house' and x.status = 'checked_in' and x.departure_date <= p_date
  loop
    select * into r from public.reservations where id = s.reservation_id for update;
    select a.room_id, rm.room_number into v_room, v_rn from public.room_assignments a join public.rooms rm on rm.id = a.room_id
    where a.reservation_id = r.id and a.is_active order by a.to_date desc limit 1;
    begin
      -- Same limit as the Extend button: never extend past the property's maximum stay.
      select max_stay_nights into v_max from public.properties where id = r.property_id;
      if v_max is not null and (p_date + 1) - r.arrival_date > v_max then
        perform app.fail('E_INVALID', 'The stay has reached the maximum of ' || v_max || ' nights at this property.');
      end if;
      perform app.assert_available(r.property_id, r.room_type_id, r.departure_date, p_date + 1, r.id);
      begin
        update public.room_assignments set to_date = p_date + 1 where reservation_id = r.id and is_active and room_id = v_room;
      exception when exclusion_violation then
        perform app.fail('E_ROOM_TAKEN', 'Room ' || v_rn || ' is booked for another guest tonight.');
      end;
      for d in select g::date from generate_series(r.departure_date, p_date, interval '1 day') g loop
        v_amt := r.rate_override;
        if v_amt is null then
          select pr.amount into v_amt from public.rate_plan_prices pr
          where pr.rate_plan_id = r.rate_plan_id and pr.room_type_id = r.room_type_id and d between pr.valid_from and pr.valid_to limit 1;
        end if;
        if v_amt is null then perform app.fail('E_NO_RATE', 'No price is set for ' || to_char(d, 'DD Mon YYYY') || '.'); end if;
        begin
          insert into public.reservation_nights(tenant_id, property_id, reservation_id, room_type_id, stay_date, rate_amount, room_id)
          values (r.tenant_id, r.property_id, r.id, r.room_type_id, d, v_amt, v_room);
        exception when unique_violation then
          perform app.fail('E_ROOM_TAKEN', 'Room ' || v_rn || ' is booked for another guest tonight.');
        end;
      end loop;
      update public.reservations set departure_date = p_date + 1,
        total_amount = (select coalesce(sum(rate_amount), 0) from public.reservation_nights where reservation_id = r.id),
        updated_at = now()
      where id = r.id;
      perform app.log_res(r, 'auto_extend_overstay', 'Still in house after departure (business date roll)',
        jsonb_build_object('from', r.departure_date, 'to', p_date + 1, 'room', v_rn));
      v_extended := v_extended + 1;
    exception when others then
      v_err := regexp_replace(sqlerrm, '^\[[A-Z0-9_]+\]\s*', '');
      perform app.log_res(r, 'overstay_not_extended', v_err, jsonb_build_object('departure', r.departure_date, 'room', v_rn));
      insert into public.notifications(tenant_id, property_id, user_id, kind, title, body, link, entity_id)
      select distinct p.tenant_id, p.id, upr.user_id, 'overstay', 'Guest still in house after departure',
        'Room ' || coalesce(v_rn, '?') || ', booking ' || r.number || ': due out ' || to_char(r.departure_date, 'DD Mon YYYY')
          || ' and still in house. The stay was not extended: ' || v_err || ' Check the guest out or move them.',
        '/reservations/' || r.id, r.id
      from public.user_property_roles upr
      join public.role_permissions rp on rp.role_id = upr.role_id and rp.permission_key = 'fin.nightaudit.run'
      join public.profiles pr on pr.id = upr.user_id and pr.status = 'active'
      where upr.property_id = p.id
        and not exists (select 1 from public.notifications n where n.user_id = upr.user_id and n.kind = 'overstay'
                        and n.entity_id = r.id and n.created_at::date = current_date);
      v_flagged := v_flagged + 1;
    end;
  end loop;
  return jsonb_build_object('extended', v_extended, 'flagged', v_flagged);
end $$;
revoke all on function app.roll_overstays(public.properties, date) from public, anon, authenticated;

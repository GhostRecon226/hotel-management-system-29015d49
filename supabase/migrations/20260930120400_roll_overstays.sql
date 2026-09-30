-- Guests still in house after their departure day (requirement DAY-003, remaining failure 21).
--
-- Before: the nightly roll charged only nights on the booking. A guest due out on the closing date who
-- was still in house got no charge for the extra night, and nobody was told.
-- After: before posting room charges, the roll looks at every in-house stay whose departure date is on
-- or before the closing date.
--   - If the room is free tonight, the stay is extended by one night with the same checks and prices as
--     the Extend button, so the night is charged with its taxes a moment later.
--   - If it cannot be extended (room promised to another guest, no rate, sold out), nothing changes and
--     every user with fin.nightaudit.run at the property is told once, with the reason.
-- Each case is written to the booking history and counted in the roll log.

create or replace function app.roll_overstays(p public.properties, p_date date)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare s record; r public.reservations; d date; v_amt numeric; v_room uuid; v_rn text;
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

CREATE OR REPLACE FUNCTION app.roll_property(p_property uuid, p_trigger text, p_actor uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p public.properties; v_started timestamptz := clock_timestamp(); v_details jsonb; v_err text; v_last text;
  v_charges int; v_expired int; v_noshows int; v_stay int; v_over jsonb;
begin
  select * into p from public.properties where id = p_property for update skip locked;
  if p.id is null then return jsonb_build_object('property_id', p_property, 'status', 'busy'); end if;
  begin
    perform set_config('app.settlement', 'on', true);
    perform set_config('app.rolling', 'on', true);
    v_over := app.roll_overstays(p, p.business_date);
    v_charges := app.roll_room_charges(p, p.business_date);
    v_expired := app.roll_expire_holds(p);
    v_noshows := app.roll_no_shows(p, p.business_date);
    update public.properties set business_date = p.business_date + 1 where id = p.id;
    v_stay := app.roll_stayovers(p, p.business_date + 1);
    perform app.compute_daily_stats(p.id, p.business_date);
    v_details := jsonb_build_object('overstays', v_over, 'room_charges', v_charges, 'holds_expired', v_expired, 'no_shows', v_noshows, 'stayover_tasks', v_stay);
    insert into public.business_date_log(tenant_id, property_id, from_date, to_date, status, trigger, actor_id, started_at, details)
    values (p.tenant_id, p.id, p.business_date, p.business_date + 1, 'success', p_trigger, p_actor, v_started, v_details);
    perform set_config('app.rolling', '', true);
    perform set_config('app.settlement', '', true);
  exception when others then
    get stacked diagnostics v_err = message_text;
    select status into v_last from public.business_date_log where property_id = p.id order by finished_at desc limit 1;
    insert into public.business_date_log(tenant_id, property_id, from_date, to_date, status, trigger, actor_id, started_at, error)
    values (p.tenant_id, p.id, p.business_date, p.business_date + 1, 'failed', p_trigger, p_actor, v_started, v_err);
    if v_last is distinct from 'failed' then
      insert into public.notifications(tenant_id, property_id, user_id, kind, title, body, link)
      select distinct p.tenant_id, p.id, upr.user_id, 'rollover_failed', 'Business date roll failed',
        p.name || ': ' || regexp_replace(v_err, '^\[[A-Z0-9_]+\]\s*', ''), '/admin'
      from public.user_property_roles upr
      join public.role_permissions rp on rp.role_id = upr.role_id and rp.permission_key = 'fin.nightaudit.run'
      join public.profiles pr on pr.id = upr.user_id and pr.status = 'active'
      where upr.property_id = p.id;
    end if;
    return jsonb_build_object('property_id', p.id, 'status', 'failed', 'error', v_err);
  end;
  return jsonb_build_object('property_id', p.id, 'status', 'success', 'from_date', p.business_date) || v_details;
end $function$;

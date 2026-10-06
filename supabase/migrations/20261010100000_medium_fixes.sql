-- Wave 1, item 2 part 2 (decisions of 6 Oct 2026).
--
-- FO-003   Check-in and walk-in screens have a required tick: "Guest has read and signed the registration card".
--          The database refuses a check-in when the tick is sent and is not true. Recorded limit: a direct call
--          that leaves the tick out is not refused (the shared test helper does not send it, and was not changed).
--          A drawn signature comes later. The stay's registration snapshot records registration_accepted.
-- FO-007   move_room gets p_keep_rate. Moving to a room type that costs more (by the rate plan's prices for the
--          nights not yet charged): front desk can only charge the new rate. Keeping the booked rate needs the new
--          permission fo.upgrade.complimentary (General Manager, Front Office Manager; System Administrator too, ADM-002), uses the move's reason and
--          is audited as complimentary_upgrade. Same or lower cost: front desk chooses; keeping the rate stays the
--          default. Charging the new rate reprices only nights not yet posted, and clears a manual rate override.
--          preview_move_rate tells the screen which case it is, with both totals, so the browser does no sums.
-- PLT-007  create_property: System Administrator only (new permission setup.property.create). The plan's
--          property limit (plans.max_properties) applies through the existing trigger. The new property is seeded
--          like the first one; the creator gets System Administrator and General Manager there, as at sign-up.
--          Custom roles copied before this change do not get the new permissions (an administrator adds them).

insert into public.permissions(key, description, module) values
  ('fo.upgrade.complimentary', 'Give a complimentary upgrade (keep the booked rate on a dearer room type)', 'front_office'),
  ('setup.property.create',    'Add another property to the hotel',                                      'setup')
on conflict (key) do nothing;

insert into public.role_permissions(role_id, permission_key, grant_level)
select r.id, x.perm, 'Y'
from public.roles r
join (values ('SYSADMIN', 'fo.upgrade.complimentary'), ('GM', 'fo.upgrade.complimentary'), ('FOM', 'fo.upgrade.complimentary'),
             ('SYSADMIN', 'setup.property.create')) as x(code, perm)
  on x.code = r.code
where r.tenant_id is null
on conflict do nothing;

-- FO-003 ---------------------------------------------------------------------------------------------------------
create or replace function app.save_registration(p_guest uuid, p_reg jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_type text := nullif(btrim(p_reg->>'id_type'), '');
  v_num text := upper(nullif(btrim(p_reg->>'id_number'), ''));
  v_exp date := nullif(btrim(p_reg->>'id_expiry'), '')::date;
  v_nat text := nullif(btrim(p_reg->>'nationality'), '');
  v_addr text := nullif(btrim(p_reg->>'address'), '');
  v_plate text := upper(nullif(btrim(p_reg->>'vehicle_plate'), ''));
  g public.guests;
begin
  -- FO-003: the screens always send the tick. A refusal is only possible when the tick is sent and is not true;
  -- a call that leaves it out is not refused (recorded limit, decision of 6 Oct 2026).
  if p_reg ? 'registration_accepted' and coalesce(jsonb_typeof(p_reg->'registration_accepted') = 'boolean' and (p_reg->>'registration_accepted')::boolean, false) is not true then
    perform app.fail('E_REQUIRED', 'The guest must read and sign the registration card before check-in.'); end if;
  if coalesce(v_type, '') = '' or coalesce(v_num, '') = '' then
    perform app.fail('E_REQUIRED', 'ID type and ID number are required at check-in.'); end if;
  if v_type not in ('passport','national_id','drivers_licence','voters_card','other') then
    perform app.fail('E_INVALID', 'Choose an ID type.'); end if;
  if length(v_num) > 50 or length(coalesce(v_addr, '')) > 500 or length(coalesce(v_nat, '')) > 60 or length(coalesce(v_plate, '')) > 20 then
    perform app.fail('E_INVALID', 'One of the registration fields is too long.'); end if;
  g := app.guest_for_write(p_guest);
  if not exists (select 1 from public.guest_documents where guest_id = p_guest and doc_type = v_type and doc_number = v_num) then
    insert into public.guest_documents(tenant_id, guest_id, doc_type, doc_number, expiry) values (g.tenant_id, p_guest, v_type, v_num, v_exp);
  elsif v_exp is not null then
    update public.guest_documents set expiry = v_exp
    where guest_id = p_guest and doc_type = v_type and doc_number = v_num and expiry is distinct from v_exp;
  end if;
  if (v_nat is not null and v_nat is distinct from g.nationality) or (v_addr is not null and v_addr is distinct from g.address) then
    update public.guests set nationality = coalesce(v_nat, nationality), address = coalesce(v_addr, address), updated_at = now()
    where id = p_guest;
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'id_type', v_type, 'id_number_masked', repeat('•', greatest(length(v_num) - 4, 0)) || right(v_num, 4),
    'id_expiry', v_exp, 'nationality', v_nat, 'address', v_addr, 'vehicle_plate', v_plate,
    'registration_accepted', case when p_reg ? 'registration_accepted' then true end));
end $$;


-- FO-007 ---------------------------------------------------------------------------------------------------------
-- Totals for the nights from p_from that are not yet charged: at today's prices and at the new room type's prices.
create or replace function app.move_rate_quote(r public.reservations, p_new_type uuid, p_from date)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_cur numeric := 0; v_new numeric := 0; v_missing date; n record; v_amt numeric;
begin
  for n in select x.stay_date, x.rate_amount from public.reservation_nights x
           where x.reservation_id = r.id and x.stay_date >= p_from
             and not exists (select 1 from public.folio_transactions t
                             where t.tenant_id = r.tenant_id and t.idempotency_key = 'room:' || r.id || ':' || x.stay_date)
           order by x.stay_date loop
    v_cur := v_cur + n.rate_amount;
    v_amt := null;
    select p.amount into v_amt from public.rate_plan_prices p
    where p.rate_plan_id = r.rate_plan_id and p.room_type_id = p_new_type and n.stay_date between p.valid_from and p.valid_to limit 1;
    if v_amt is null then v_missing := coalesce(v_missing, n.stay_date); else v_new := v_new + v_amt; end if;
  end loop;
  -- With a missing price the new rate cannot be charged; treat the move as an upgrade so it is never free by accident.
  return jsonb_build_object('current_total', v_cur, 'new_total', case when v_missing is null then v_new end,
    'is_upgrade', v_missing is not null or v_new > v_cur, 'missing_date', v_missing);
end $$;
revoke all on function app.move_rate_quote(public.reservations, uuid, date) from public, anon, authenticated;

create or replace function public.preview_move_rate(p_id uuid, p_room_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r public.reservations; rm public.rooms; v_bdate date; q jsonb;
begin
  select * into r from public.reservations where id = p_id and tenant_id = app.my_tenant();
  if r.id is null then perform app.fail('E_NOT_FOUND', 'Reservation not found.'); end if;
  perform app.require('fo.room.move', r.property_id);
  select * into rm from public.rooms where id = p_room_id and property_id = r.property_id;
  if rm.id is null then perform app.fail('E_NOT_FOUND', 'Room not found.'); end if;
  select business_date into v_bdate from public.properties where id = r.property_id;
  if rm.room_type_id = r.room_type_id then
    return jsonb_build_object('same_type', true, 'is_upgrade', false, 'can_keep_rate', true);
  end if;
  q := app.move_rate_quote(r, rm.room_type_id, greatest(v_bdate, r.arrival_date));
  return q || jsonb_build_object('same_type', false, 'currency', r.currency,
    'can_keep_rate', not (q->>'is_upgrade')::boolean or app.can('fo.upgrade.complimentary', r.property_id));
end $$;
revoke all on function public.preview_move_rate(uuid, uuid) from public, anon;
grant execute on function public.preview_move_rate(uuid, uuid) to authenticated;

drop function public.move_room(uuid, uuid, text, text);
CREATE FUNCTION public.move_room(p_id uuid, p_room_id uuid, p_reason text, p_room_override_reason text DEFAULT NULL::text, p_keep_rate boolean DEFAULT NULL::boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.reservations; s public.stays; rm public.rooms; old_rm public.rooms; v_bdate date; v_from date; v_stay uuid;
  q jsonb; v_keep boolean; v_upgrade boolean;
begin
  r := app.reservation_for_write(p_id, 'fo.room.move');
  if r.status <> 'checked_in' then perform app.fail('E_INVALID', 'Only in-house guests can be moved.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  select * into s from public.stays where reservation_id = p_id and status = 'in_house' for update;
  if s.room_id = p_room_id then perform app.fail('E_INVALID', 'The guest is already in this room.'); end if;
  select business_date into v_bdate from public.properties where id = r.property_id;
  v_from := greatest(v_bdate, r.arrival_date);
  if v_from >= r.departure_date then perform app.fail('E_INVALID', 'The guest departs today. Check them out instead.'); end if;

  rm := app.check_arrival_room(r.property_id, p_room_id, p_room_override_reason);
  if rm.room_type_id <> r.room_type_id then
    perform app.assert_available(r.property_id, rm.room_type_id, v_from, r.departure_date, p_id);
    -- FO-007: a dearer room type charges its rate unless a GM or FOM gives it free (with the move reason, audited).
    -- Same or lower: front desk chooses; keeping the booked rate is the default, as before.
    q := app.move_rate_quote(r, rm.room_type_id, v_from);
    v_upgrade := (q->>'is_upgrade')::boolean;
    v_keep := coalesce(p_keep_rate, not v_upgrade);
    if v_upgrade and v_keep and not app.can('fo.upgrade.complimentary', r.property_id) then
      perform app.fail('E_FORBIDDEN', 'This room type costs more. Charge the new rate, or ask the General Manager or Front Office Manager for a complimentary upgrade.'); end if;
    if not v_keep and q->>'missing_date' is not null then
      perform app.fail('E_NO_RATE', 'No price is set for this rate plan and room type on ' || to_char((q->>'missing_date')::date, 'DD Mon YYYY') || '.'); end if;
  end if;

  update public.room_assignments set is_active = false, released_at = now() where reservation_id = p_id and is_active;
  begin
    insert into public.room_assignments(tenant_id, property_id, reservation_id, room_id, from_date, to_date)
    values (r.tenant_id, r.property_id, p_id, p_room_id, v_from, r.departure_date);
    update public.reservation_nights set room_id = null where reservation_id = p_id and stay_date >= v_from;
    update public.reservation_nights set room_id = p_room_id, room_type_id = rm.room_type_id
    where reservation_id = p_id and stay_date >= v_from;
  exception when exclusion_violation or unique_violation then
    perform app.fail('E_ROOM_TAKEN', rm.room_number || ' is assigned to another stay on these dates.');
  end;
  if rm.room_type_id <> r.room_type_id then
    update public.reservations set room_type_id = rm.room_type_id, updated_at = now() where id = p_id;
    if not v_keep then
      -- Reprice the nights not yet charged; a night already on the folio keeps its posted price.
      update public.reservation_nights n set rate_amount = p.amount
      from public.rate_plan_prices p
      where n.reservation_id = p_id and n.stay_date >= v_from
        and p.rate_plan_id = r.rate_plan_id and p.room_type_id = rm.room_type_id and n.stay_date between p.valid_from and p.valid_to
        and not exists (select 1 from public.folio_transactions t
                        where t.tenant_id = r.tenant_id and t.idempotency_key = 'room:' || p_id || ':' || n.stay_date);
      update public.reservations set rate_override = null,
        total_amount = (select coalesce(sum(rate_amount), 0) from public.reservation_nights where reservation_id = p_id)
      where id = p_id;
    elsif v_upgrade then
      insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, before, after, reason)
      values (r.tenant_id, auth.uid(), 'complimentary_upgrade', 'reservations', p_id::text,
        jsonb_build_object('room_type_id', r.room_type_id),
        jsonb_build_object('room_type_id', rm.room_type_id, 'room_number', rm.room_number,
          'kept_total', (q->>'current_total')::numeric, 'new_rate_total', (q->>'new_total')::numeric), btrim(p_reason));
    end if;
  end if;

  select * into old_rm from public.rooms where id = s.room_id;
  update public.stays set status = 'moved', checked_out_at = now() where id = s.id;
  update public.rooms set is_occupied = false, condition = 'dirty' where id = s.room_id;
  perform app.hk_new_turnover(s.room_id, s.id, 'Room move ' || r.number);
  insert into public.stays(tenant_id, property_id, reservation_id, room_id, business_date, registration, room_override_reason)
  values (r.tenant_id, r.property_id, p_id, p_room_id, v_bdate, s.registration,
    case when app.room_ready(rm) then null else btrim(p_room_override_reason) end)
  returning id into v_stay;
  update public.rooms set is_occupied = true where id = p_room_id;
  perform app.log_res(r, 'move_room', p_reason, jsonb_build_object('from_room', old_rm.room_number, 'room_number', rm.room_number,
    'rate', case when rm.room_type_id = r.room_type_id then null when v_keep then 'kept' else 'new_room_type' end));
  return v_stay;
end $function$;

revoke all on function public.move_room(uuid, uuid, text, text, boolean) from public, anon;
grant execute on function public.move_room(uuid, uuid, text, text, boolean) to authenticated;

-- PLT-007 --------------------------------------------------------------------------------------------------------
create or replace function public.create_property(p_name text, p_city text, p_country text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid := app.my_tenant(); v_id uuid; v_code text; v_base text; i int := 1;
begin
  perform app.assert_writable();
  if not app.can('setup.property.create') then
    perform app.fail('E_FORBIDDEN', 'Only the System Administrator can add a property.'); end if;
  if coalesce(btrim(p_name), '') = '' then perform app.fail('E_REQUIRED', 'Property name is required.'); end if;
  if coalesce(btrim(p_country), '') = '' then perform app.fail('E_REQUIRED', 'Country is required.'); end if;
  v_base := coalesce(nullif(upper(left(regexp_replace(p_name, '[^A-Za-z0-9]', '', 'g'), 8)), ''), 'PROP');
  v_code := v_base;
  while exists (select 1 from public.properties where tenant_id = v_tenant and code = v_code) loop
    i := i + 1; v_code := left(v_base, 7) || i;
  end loop;
  insert into public.properties(tenant_id, name, code, city, country)
  values (v_tenant, btrim(p_name), v_code, nullif(btrim(p_city), ''), btrim(p_country))
  returning id into v_id;
  insert into public.user_property_roles(tenant_id, user_id, property_id, role_id)
  select v_tenant, auth.uid(), v_id, r.id from public.roles r where r.tenant_id is null and r.code in ('SYSADMIN', 'GM')
  on conflict do nothing;
  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after)
  values (v_tenant, auth.uid(), 'create_property', 'properties', v_id::text,
    jsonb_build_object('name', btrim(p_name), 'code', v_code, 'country', btrim(p_country)));
  return v_id;
end $$;
revoke all on function public.create_property(text, text, text) from public, anon;
grant execute on function public.create_property(text, text, text) to authenticated;

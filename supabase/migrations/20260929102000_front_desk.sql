-- Front desk: stays, check-in, walk-in, void check-in, room move, extend stay.
-- Check-out is not built yet (needs the folio).

insert into public.permissions(key, description, module) values
  ('fo.room.override',  'Check a guest into a room that is not ready', 'front_office'),
  ('fo.deposit.waive',  'Waive the required deposit at check-in',      'front_office'),
  ('fo.checkin.void',   'Void a check-in made in error',               'front_office'),
  ('fo.stay.extend',    'Extend an in-house stay',                     'front_office')
on conflict (key) do nothing;

insert into public.role_permissions(role_id, permission_key, grant_level)
select r.id, k.key, 'Y' from public.roles r
cross join (values ('fo.room.override'), ('fo.deposit.waive'), ('fo.checkin.void'), ('fo.stay.extend')) k(key)
where r.tenant_id is null and r.code in ('SYSADMIN', 'GM', 'FOM')
on conflict do nothing;

insert into public.role_permissions(role_id, permission_key, grant_level)
select r.id, 'fo.stay.extend', 'Y' from public.roles r
where r.tenant_id is null and r.code = 'FDO'
on conflict do nothing;

create table public.stays (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  property_id           uuid not null references public.properties(id) on delete cascade,
  reservation_id        uuid not null references public.reservations(id) on delete cascade,
  room_id               uuid not null references public.rooms(id),
  checked_in_at         timestamptz not null default now(),
  checked_out_at        timestamptz,
  business_date         date not null,
  registration          jsonb not null default '{}'::jsonb,
  status                text not null default 'in_house' check (status in ('in_house', 'moved', 'voided', 'checked_out')),
  room_override_reason  text,
  deposit_waive_reason  text,
  void_reason           text,
  created_by            uuid default auth.uid(),
  created_at            timestamptz not null default now()
);
create index stays_reservation_idx on public.stays(reservation_id);
create unique index stays_one_in_house_per_res on public.stays(reservation_id) where status = 'in_house';
create unique index stays_one_in_house_per_room on public.stays(room_id) where status = 'in_house';
create index stays_property_status_idx on public.stays(property_id, status);

grant select on public.stays to authenticated;
grant all on public.stays to service_role;
alter table public.stays enable row level security;
create policy "Front desk reads stays" on public.stays for select to authenticated
  using (tenant_id = app.my_tenant() and app.can('fo.view', property_id));

create trigger stays_enforce_writable before insert or update or delete on public.stays
  for each row execute function app.enforce_writable();

-- Deposit received so far. Returns 0 until folios/payments exist; replace then.
create or replace function app.deposit_paid(p_res uuid)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select 0::numeric
$$;
grant execute on function app.deposit_paid(uuid) to authenticated, service_role;

create or replace function app.room_ready(rm public.rooms)
returns boolean language sql immutable as $$
  select rm.is_active and rm.condition in ('clean', 'inspected') and not rm.is_occupied
$$;

-- Locks the room and checks it can take an arriving guest. Dirty rooms need an override.
create or replace function app.check_arrival_room(p_property uuid, p_room uuid, p_override_reason text)
returns public.rooms language plpgsql security definer set search_path = public, pg_temp as $$
declare rm public.rooms;
begin
  select * into rm from public.rooms where id = p_room and property_id = p_property for update;
  if rm.id is null then perform app.fail('E_NOT_FOUND', 'Room not found.'); end if;
  if not rm.is_active or rm.condition = 'out_of_order' then
    perform app.fail('E_ROOM_NOT_READY', 'Room ' || rm.room_number || ' is blocked and cannot be used.'); end if;
  if rm.is_occupied then perform app.fail('E_ROOM_NOT_READY', 'Room ' || rm.room_number || ' is occupied.'); end if;
  if not app.room_ready(rm) then
    if not app.can('fo.room.override', p_property) then
      perform app.fail('E_ROOM_NOT_READY', 'Room ' || rm.room_number || ' is not ready. Only clean or inspected rooms can be used.'); end if;
    if coalesce(btrim(p_override_reason), '') = '' then
      perform app.fail('E_REQUIRED', 'A reason is required to use a room that is not ready.'); end if;
  end if;
  return rm;
end $$;

-- Assigns a room for the whole reservation (arrival rooms only).
create or replace function app.set_arrival_room(r public.reservations, p_room uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare rm public.rooms;
begin
  select * into rm from public.rooms where id = p_room and property_id = r.property_id;
  if rm.id is null then perform app.fail('E_NOT_FOUND', 'Room not found.'); end if;
  if rm.room_type_id <> r.room_type_id then perform app.fail('E_INVALID', 'The room must be of the booked room type.'); end if;
  if exists (select 1 from public.room_assignments where reservation_id = r.id and is_active and room_id = p_room) then return; end if;
  perform app.release_rooms(r.id);
  begin
    insert into public.room_assignments(tenant_id, property_id, reservation_id, room_id, from_date, to_date)
    values (r.tenant_id, r.property_id, r.id, p_room, r.arrival_date, r.departure_date);
    update public.reservation_nights set room_id = p_room where reservation_id = r.id;
  exception when exclusion_violation or unique_violation then
    perform app.fail('E_ROOM_TAKEN', 'Room ' || rm.room_number || ' is already assigned to another stay on these dates.');
  end;
  perform app.log_res(r, 'assign_room', null, jsonb_build_object('room_id', p_room, 'room_number', rm.room_number));
end $$;

-- Saves ID/nationality/address to the guest profile; returns the registration with the ID number masked.
create or replace function app.save_registration(p_guest uuid, p_reg jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_type text := nullif(btrim(p_reg->>'id_type'), '');
  v_num text := upper(nullif(btrim(p_reg->>'id_number'), ''));
  v_nat text := nullif(btrim(p_reg->>'nationality'), '');
  v_addr text := nullif(btrim(p_reg->>'address'), '');
  v_plate text := upper(nullif(btrim(p_reg->>'vehicle_plate'), ''));
  g public.guests;
begin
  if coalesce(v_type, '') = '' or coalesce(v_num, '') = '' then
    perform app.fail('E_REQUIRED', 'ID type and ID number are required at check-in.'); end if;
  if v_type not in ('passport','national_id','drivers_licence','voters_card','other') then
    perform app.fail('E_INVALID', 'Choose an ID type.'); end if;
  if length(v_num) > 50 or length(coalesce(v_addr, '')) > 500 or length(coalesce(v_nat, '')) > 60 or length(coalesce(v_plate, '')) > 20 then
    perform app.fail('E_INVALID', 'One of the registration fields is too long.'); end if;
  g := app.guest_for_write(p_guest);
  if not exists (select 1 from public.guest_documents where guest_id = p_guest and doc_type = v_type and doc_number = v_num) then
    insert into public.guest_documents(tenant_id, guest_id, doc_type, doc_number) values (g.tenant_id, p_guest, v_type, v_num);
  end if;
  if (v_nat is not null and v_nat is distinct from g.nationality) or (v_addr is not null and v_addr is distinct from g.address) then
    update public.guests set nationality = coalesce(v_nat, nationality), address = coalesce(v_addr, address), updated_at = now()
    where id = p_guest;
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'id_type', v_type, 'id_number_masked', repeat('•', greatest(length(v_num) - 4, 0)) || right(v_num, 4),
    'nationality', v_nat, 'address', v_addr, 'vehicle_plate', v_plate));
end $$;

create or replace function app.do_check_in(p_id uuid, p_room_id uuid, p_registration jsonb,
  p_room_override_reason text, p_deposit_waive_reason text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; v_bdate date; v_room uuid; rm public.rooms; v_due numeric; v_reg jsonb; v_stay uuid;
begin
  select * into r from public.reservations where id = p_id for update;
  if r.status not in ('tentative', 'confirmed') then perform app.fail('E_INVALID', 'Only tentative or confirmed bookings can be checked in.'); end if;
  select business_date into v_bdate from public.properties where id = r.property_id;
  if r.arrival_date > v_bdate then perform app.fail('E_INVALID', 'This booking arrives on ' || to_char(r.arrival_date, 'DD Mon YYYY') || '. Change the arrival date first.'); end if;
  if r.departure_date <= v_bdate then perform app.fail('E_INVALID', 'This stay has already ended.'); end if;
  if r.status = 'tentative' and r.hold_until is not null and r.hold_until <= now() then
    perform app.assert_available(r.property_id, r.room_type_id, r.arrival_date, r.departure_date, r.id);
  end if;

  if p_room_id is not null then perform app.set_arrival_room(r, p_room_id); end if;
  select room_id into v_room from public.room_assignments where reservation_id = r.id and is_active limit 1;
  if v_room is null then perform app.fail('E_NO_ROOM', 'Assign a room before check-in.'); end if;
  rm := app.check_arrival_room(r.property_id, v_room, p_room_override_reason);

  v_due := r.deposit_required - app.deposit_paid(r.id);
  if v_due > 0 then
    if coalesce(btrim(p_deposit_waive_reason), '') = '' then
      perform app.fail('E_DEPOSIT_REQUIRED', 'A deposit of ' || to_char(v_due, 'FM999,999,999,990.00') || ' is required before check-in.'); end if;
    if not app.can('fo.deposit.waive', r.property_id) then
      perform app.fail('E_FORBIDDEN', 'Only a manager can waive the deposit.'); end if;
  end if;

  v_reg := app.save_registration(r.guest_id, coalesce(p_registration, '{}'::jsonb));

  insert into public.stays(tenant_id, property_id, reservation_id, room_id, business_date, registration,
    room_override_reason, deposit_waive_reason)
  values (r.tenant_id, r.property_id, r.id, v_room, v_bdate, v_reg,
    case when app.room_ready(rm) then null else btrim(p_room_override_reason) end,
    case when v_due > 0 then btrim(p_deposit_waive_reason) else null end)
  returning id into v_stay;

  update public.rooms set is_occupied = true where id = v_room;
  update public.reservations set status = 'checked_in', hold_until = null, updated_at = now() where id = r.id;
  perform app.log_res(r, 'check_in', null, jsonb_strip_nulls(jsonb_build_object('room_number', rm.room_number,
    'room_override_reason', case when app.room_ready(rm) then null else btrim(p_room_override_reason) end,
    'deposit_waived', case when v_due > 0 then v_due end,
    'deposit_waive_reason', case when v_due > 0 then btrim(p_deposit_waive_reason) end)));
  return v_stay;
end $$;

create or replace function public.check_in(p_id uuid, p_registration jsonb, p_room_id uuid default null,
  p_room_override_reason text default null, p_deposit_waive_reason text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; v_stay uuid;
begin
  r := app.reservation_for_write(p_id, 'fo.checkin');
  if r.status = 'checked_in' then
    select id into v_stay from public.stays where reservation_id = p_id and status = 'in_house';
    return v_stay;
  end if;
  return app.do_check_in(p_id, p_room_id, p_registration, p_room_override_reason, p_deposit_waive_reason);
end $$;

create or replace function public.walk_in_check_in(
  p_property_id uuid, p_idempotency_key text, p_guest_id uuid, p_departure date,
  p_room_type_id uuid, p_rate_plan_id uuid, p_adults integer, p_children integer, p_room_id uuid,
  p_registration jsonb, p_company_name text default null, p_notes text default null,
  p_rate_override numeric default null, p_override_reason text default null,
  p_room_override_reason text default null, p_deposit_waive_reason text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_bdate date; r public.reservations;
begin
  perform app.require('fo.walkin', p_property_id);
  perform app.require('fo.checkin', p_property_id);
  if p_room_id is null then perform app.fail('E_NO_ROOM', 'Choose a room for the walk-in guest.'); end if;
  select id into v_id from public.reservations where tenant_id = app.my_tenant() and idempotency_key = btrim(p_idempotency_key);
  if v_id is not null and exists (select 1 from public.reservations where id = v_id and status = 'checked_in') then return v_id; end if;

  select business_date into v_bdate from public.properties where id = p_property_id;
  v_id := public.create_reservation(p_property_id, p_idempotency_key, p_guest_id, v_bdate, p_departure,
    p_room_type_id, p_rate_plan_id, p_adults, p_children, 'confirmed', 'walk_in', p_company_name,
    null, p_notes, 'none', null, null, p_rate_override, p_override_reason);
  select * into r from public.reservations where id = v_id;
  perform app.set_arrival_room(r, p_room_id);
  perform app.do_check_in(v_id, null, p_registration, p_room_override_reason, p_deposit_waive_reason);
  return v_id;
end $$;

create or replace function public.void_check_in(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; s public.stays; v_bdate date;
begin
  r := app.reservation_for_write(p_id, 'fo.checkin.void');
  if r.status <> 'checked_in' then perform app.fail('E_INVALID', 'Only in-house bookings can have their check-in voided.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  if exists (select 1 from public.stays where reservation_id = p_id and status = 'moved') then
    perform app.fail('E_INVALID', 'This guest has moved rooms, so the check-in cannot be voided.'); end if;
  select * into s from public.stays where reservation_id = p_id and status = 'in_house' for update;
  select business_date into v_bdate from public.properties where id = r.property_id;
  if s.business_date <> v_bdate then perform app.fail('E_INVALID', 'A check-in can only be voided on the day it was made.'); end if;
  update public.stays set status = 'voided', checked_out_at = now(), void_reason = btrim(p_reason) where id = s.id;
  update public.rooms set is_occupied = false, condition = 'dirty' where id = s.room_id;
  perform set_config('app.audit_reason', btrim(p_reason), true);
  update public.reservations set status = 'confirmed', updated_at = now() where id = p_id;
  perform set_config('app.audit_reason', '', true);
  perform app.log_res(r, 'void_check_in', p_reason, null);
end $$;

create or replace function public.move_room(p_id uuid, p_room_id uuid, p_reason text, p_room_override_reason text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; s public.stays; rm public.rooms; old_rm public.rooms; v_bdate date; v_from date; v_stay uuid;
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
  end if;

  update public.room_assignments set is_active = false, released_at = now() where reservation_id = p_id and is_active;
  begin
    insert into public.room_assignments(tenant_id, property_id, reservation_id, room_id, from_date, to_date)
    values (r.tenant_id, r.property_id, p_id, p_room_id, v_from, r.departure_date);
    update public.reservation_nights set room_id = null where reservation_id = p_id and stay_date >= v_from;
    update public.reservation_nights set room_id = p_room_id, room_type_id = rm.room_type_id
    where reservation_id = p_id and stay_date >= v_from;
  exception when exclusion_violation or unique_violation then
    perform app.fail('E_ROOM_TAKEN', 'Room ' || rm.room_number || ' is assigned to another stay on these dates.');
  end;
  if rm.room_type_id <> r.room_type_id then
    update public.reservations set room_type_id = rm.room_type_id, updated_at = now() where id = p_id;
  end if;

  select * into old_rm from public.rooms where id = s.room_id;
  update public.stays set status = 'moved', checked_out_at = now() where id = s.id;
  update public.rooms set is_occupied = false, condition = 'dirty' where id = s.room_id;
  insert into public.stays(tenant_id, property_id, reservation_id, room_id, business_date, registration, room_override_reason)
  values (r.tenant_id, r.property_id, p_id, p_room_id, v_bdate, s.registration,
    case when app.room_ready(rm) then null else btrim(p_room_override_reason) end)
  returning id into v_stay;
  update public.rooms set is_occupied = true where id = p_room_id;
  perform app.log_res(r, 'move_room', p_reason, jsonb_build_object('from_room', old_rm.room_number, 'room_number', rm.room_number));
  return v_stay;
end $$;

create or replace function public.extend_stay(p_id uuid, p_new_departure date, p_reason text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; v_max int; d date; v_amt numeric; v_room uuid; v_rn text;
begin
  r := app.reservation_for_write(p_id, 'fo.stay.extend');
  if r.status <> 'checked_in' then perform app.fail('E_INVALID', 'Only in-house stays can be extended.'); end if;
  if p_new_departure is null or p_new_departure <= r.departure_date then
    perform app.fail('E_INVALID', 'The new departure must be after ' || to_char(r.departure_date, 'DD Mon YYYY') || '.'); end if;
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

  perform set_config('app.audit_reason', coalesce(btrim(p_reason), ''), true);
  update public.reservations set departure_date = p_new_departure,
    total_amount = (select coalesce(sum(rate_amount), 0) from public.reservation_nights where reservation_id = p_id),
    updated_at = now()
  where id = p_id;
  perform set_config('app.audit_reason', '', true);
end $$;

-- Rooms free for the given dates, with a ready flag. Used by check-in, walk-in and move pickers.
create or replace function public.get_front_desk_rooms(p_property_id uuid, p_room_type_id uuid, p_from date, p_to date,
  p_reservation_id uuid default null)
returns table(id uuid, room_number text, floor text, room_type_id uuid, room_type_code text,
              condition text, is_occupied boolean, is_ready boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not app.can('fo.view', p_property_id) then perform app.fail('E_FORBIDDEN', 'You do not have permission to view the front desk.'); end if;
  if p_from is null or p_to is null or p_to <= p_from then perform app.fail('E_INVALID', 'Departure must be after arrival.'); end if;
  return query
  select rm.id, rm.room_number, rm.floor, rm.room_type_id, rt.code, rm.condition, rm.is_occupied, app.room_ready(rm)
  from public.rooms rm join public.room_types rt on rt.id = rm.room_type_id
  where rm.property_id = p_property_id and rm.is_active and rm.condition <> 'out_of_order'
    and (p_room_type_id is null or rm.room_type_id = p_room_type_id)
    and not exists (select 1 from public.room_assignments a
      where a.room_id = rm.id and a.is_active and a.reservation_id is distinct from p_reservation_id
        and daterange(a.from_date, a.to_date, '[)') && daterange(p_from, p_to, '[)'))
  order by rt.code, length(rm.room_number), rm.room_number;
end $$;

create view public.v_arrivals with (security_invoker = true) as
select r.id, r.property_id, r.number, r.guest_id,
  nullif(btrim(coalesce(g.first_name, '') || ' ' || coalesce(g.last_name, '')), '') as guest_name,
  g.phone as guest_phone, r.arrival_date, r.departure_date, r.departure_date - r.arrival_date as nights,
  r.adults, r.children, r.room_type_id, rt.code as room_type_code, rt.name as room_type_name, r.rate_plan_id,
  r.status, r.hold_until, r.company_name, r.special_requests, r.total_amount, r.currency, r.deposit_required,
  app.deposit_paid(r.id) as deposit_paid,
  a.room_id, rm.room_number, rm.condition as room_condition, rm.is_occupied as room_is_occupied,
  (rm.id is not null and rm.is_active and rm.condition in ('clean', 'inspected') and not rm.is_occupied) as room_is_ready,
  r.arrival_date < p.business_date as is_late
from public.reservations r
join public.properties p on p.id = r.property_id
join public.room_types rt on rt.id = r.room_type_id
left join public.guests g on g.id = r.guest_id
left join lateral (select x.room_id from public.room_assignments x where x.reservation_id = r.id and x.is_active limit 1) a on true
left join public.rooms rm on rm.id = a.room_id
where r.status in ('tentative', 'confirmed')
  and r.arrival_date <= p.business_date and r.departure_date > p.business_date;

create view public.v_in_house with (security_invoker = true) as
select s.id as stay_id, r.id as reservation_id, r.property_id, r.number, r.guest_id,
  nullif(btrim(coalesce(g.first_name, '') || ' ' || coalesce(g.last_name, '')), '') as guest_name,
  g.phone as guest_phone, s.room_id, rm.room_number, r.room_type_id, rt.code as room_type_code,
  r.arrival_date, r.departure_date, s.checked_in_at, s.business_date as checked_in_business_date,
  r.adults, r.children, r.company_name, r.total_amount, r.currency,
  r.departure_date <= p.business_date as is_departing,
  s.business_date = p.business_date and not exists
    (select 1 from public.stays m where m.reservation_id = r.id and m.status = 'moved') as can_void
from public.stays s
join public.reservations r on r.id = s.reservation_id
join public.properties p on p.id = s.property_id
join public.rooms rm on rm.id = s.room_id
join public.room_types rt on rt.id = r.room_type_id
left join public.guests g on g.id = r.guest_id
where s.status = 'in_house';

grant select on public.v_arrivals, public.v_in_house to authenticated;
grant select on public.v_arrivals, public.v_in_house to service_role;

-- Anonymising a guest also clears the registration copies on their stays.
create or replace function app.scrub_stay_registration()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.stays set registration = jsonb_build_object('anonymised', true)
  where reservation_id in (select id from public.reservations where guest_id = new.id);
  return null;
end $$;
create trigger guests_scrub_stays after update of anonymised_at on public.guests
  for each row when (old.anonymised_at is null and new.anonymised_at is not null)
  execute function app.scrub_stay_registration();

revoke all on function app.check_arrival_room(uuid, uuid, text), app.set_arrival_room(public.reservations, uuid),
  app.save_registration(uuid, jsonb), app.do_check_in(uuid, uuid, jsonb, text, text) from public;

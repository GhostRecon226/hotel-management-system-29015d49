-- Reservations and availability.
-- reservation_nights is the source of availability. Room assignments cannot overlap (exclusion constraint).

create extension if not exists btree_gist;

alter table public.properties
  add column if not exists max_stay_nights integer not null default 30,
  add column if not exists tentative_hold_hours integer not null default 24;
alter table public.properties
  add constraint properties_max_stay_nights_chk check (max_stay_nights between 1 and 365),
  add constraint properties_tentative_hold_hours_chk check (tentative_hold_hours between 1 and 720);

insert into public.permissions(key, description, module) values
  ('res.rate.override', 'Override the nightly room rate', 'reservations')
on conflict (key) do nothing;

insert into public.role_permissions(role_id, permission_key, grant_level)
select r.id, 'res.rate.override', 'Y' from public.roles r
where r.tenant_id is null and r.code in ('SYSADMIN', 'GM', 'FOM')
on conflict do nothing;

create table public.group_bookings (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  property_id   uuid not null references public.properties(id) on delete cascade,
  name          text not null,
  contact_name  text,
  contact_phone text,
  notes         text,
  status        text not null default 'active' check (status in ('active', 'cancelled')),
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now()
);

create table public.reservations (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  property_id       uuid not null references public.properties(id) on delete cascade,
  number            text not null,
  guest_id          uuid not null references public.guests(id),
  arrival_date      date not null,
  departure_date    date not null,
  room_type_id      uuid not null references public.room_types(id),
  rate_plan_id      uuid not null references public.rate_plans(id),
  adults            integer not null default 1 check (adults >= 1),
  children          integer not null default 0 check (children >= 0),
  status            text not null default 'confirmed'
                    check (status in ('tentative','confirmed','cancelled','no_show','checked_in','checked_out')),
  source            text not null default 'direct' check (source in ('direct','walk_in','phone','corporate','other')),
  company_name      text,
  special_requests  text,
  notes             text,
  guarantee         text not null default 'none' check (guarantee in ('none','card','deposit','company','other')),
  hold_until        timestamptz,
  group_id          uuid references public.group_bookings(id),
  idempotency_key   text not null,
  currency          character(3) not null default 'NGN',
  total_amount      numeric(20,4) not null default 0,
  deposit_required  numeric(20,4) not null default 0,
  rate_override     numeric(20,4),
  override_reason   text,
  cancellation_fee  numeric(20,4),
  no_show_fee       numeric(20,4),
  fee_waived        boolean not null default false,
  status_reason     text,
  cancelled_at      timestamptz,
  created_by        uuid default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint reservations_dates_chk check (departure_date > arrival_date),
  constraint reservations_number_uq unique (property_id, number),
  constraint reservations_idempotency_uq unique (tenant_id, idempotency_key)
);
create index reservations_property_dates_idx on public.reservations(property_id, arrival_date, departure_date);
create index reservations_guest_idx on public.reservations(guest_id);

create table public.reservation_nights (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  property_id    uuid not null references public.properties(id) on delete cascade,
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  room_type_id   uuid not null references public.room_types(id),
  stay_date      date not null,
  rate_amount    numeric(20,4) not null check (rate_amount >= 0),
  room_id        uuid references public.rooms(id),
  constraint reservation_nights_uq unique (reservation_id, stay_date)
);
create index reservation_nights_avail_idx on public.reservation_nights(property_id, room_type_id, stay_date);
create unique index reservation_nights_room_night_uq on public.reservation_nights(room_id, stay_date) where room_id is not null;

create table public.room_assignments (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  property_id    uuid not null references public.properties(id) on delete cascade,
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  room_id        uuid not null references public.rooms(id),
  from_date      date not null,
  to_date        date not null,
  is_active      boolean not null default true,
  released_at    timestamptz,
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now(),
  constraint room_assignments_dates_chk check (to_date > from_date),
  constraint room_assignments_no_overlap exclude using gist (
    room_id with =, daterange(from_date, to_date, '[)') with &&
  ) where (is_active)
);
create index room_assignments_res_idx on public.room_assignments(reservation_id);

create table public.reservation_guests (
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  guest_id       uuid not null references public.guests(id),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  is_primary     boolean not null default false,
  primary key (reservation_id, guest_id)
);

grant select on public.group_bookings, public.reservations, public.reservation_nights,
  public.room_assignments, public.reservation_guests to authenticated;
grant all on public.group_bookings, public.reservations, public.reservation_nights,
  public.room_assignments, public.reservation_guests to service_role;

alter table public.group_bookings enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_nights enable row level security;
alter table public.room_assignments enable row level security;
alter table public.reservation_guests enable row level security;

create policy "Reservation viewers read groups" on public.group_bookings for select to authenticated
  using (tenant_id = app.my_tenant() and app.can('res.view', property_id));
create policy "Reservation viewers read reservations" on public.reservations for select to authenticated
  using (tenant_id = app.my_tenant() and app.can('res.view', property_id));
create policy "Reservation viewers read nights" on public.reservation_nights for select to authenticated
  using (tenant_id = app.my_tenant() and app.can('res.view', property_id));
create policy "Reservation viewers read assignments" on public.room_assignments for select to authenticated
  using (tenant_id = app.my_tenant() and app.can('res.view', property_id));
create policy "Reservation viewers read reservation guests" on public.reservation_guests for select to authenticated
  using (tenant_id = app.my_tenant() and app.can('res.view', null));

create trigger group_bookings_enforce_writable before insert or update or delete on public.group_bookings
  for each row execute function app.enforce_writable();
create trigger reservations_enforce_writable before insert or update or delete on public.reservations
  for each row execute function app.enforce_writable();
create trigger reservation_nights_enforce_writable before insert or update or delete on public.reservation_nights
  for each row execute function app.enforce_writable();
create trigger room_assignments_enforce_writable before insert or update or delete on public.room_assignments
  for each row execute function app.enforce_writable();
create trigger reservation_guests_enforce_writable before insert or update or delete on public.reservation_guests
  for each row execute function app.enforce_writable();

create trigger audit_reservations after insert or update or delete on public.reservations
  for each row execute function app.audit_row();

create or replace function app.availability(p_property uuid, p_arrival date, p_departure date, p_exclude uuid default null)
returns table(room_type_id uuid, stay_date date, sellable integer, reserved integer)
language sql stable security definer set search_path = public, pg_temp as $$
  select rt.id, d::date,
    (select count(*)::int from public.rooms rm
      where rm.room_type_id = rt.id and rm.is_active and rm.condition <> 'out_of_order'),
    (select count(*)::int from public.reservation_nights n
      join public.reservations r on r.id = n.reservation_id
      where n.room_type_id = rt.id and n.stay_date = d::date
        and r.id is distinct from p_exclude
        and (r.status in ('confirmed', 'checked_in')
             or (r.status = 'tentative' and (r.hold_until is null or r.hold_until > now()))))
  from public.room_types rt
  cross join generate_series(p_arrival, p_departure - 1, interval '1 day') d
  where rt.property_id = p_property and rt.is_active
$$;

create or replace function app.assert_available(p_property uuid, p_room_type uuid, p_arrival date, p_departure date, p_exclude uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_day date;
begin
  perform pg_advisory_xact_lock(hashtextextended('avail:' || p_property::text || ':' || p_room_type::text, 0));
  select a.stay_date into v_day
  from app.availability(p_property, p_arrival, p_departure, p_exclude) a
  where a.room_type_id = p_room_type and a.sellable - a.reserved <= 0
  order by a.stay_date limit 1;
  if v_day is not null then
    perform app.fail('E_NO_AVAILABILITY', 'No rooms of this type are free on ' || to_char(v_day, 'DD Mon YYYY') || '.');
  end if;
end $$;

create or replace function app.validate_stay(p_property uuid, p_arrival date, p_departure date,
  p_room_type uuid, p_rate_plan uuid, p_adults integer, p_children integer)
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_max int; rt public.room_types;
begin
  if p_arrival is null or p_departure is null then perform app.fail('E_REQUIRED', 'Arrival and departure dates are required.'); end if;
  if p_departure <= p_arrival then perform app.fail('E_INVALID', 'Departure must be after arrival.'); end if;
  select max_stay_nights into v_max from public.properties where id = p_property;
  if p_departure - p_arrival > v_max then
    perform app.fail('E_INVALID', 'Stays can be at most ' || v_max || ' nights at this property.'); end if;
  select * into rt from public.room_types where id = p_room_type and property_id = p_property and is_active;
  if rt.id is null then perform app.fail('E_INVALID', 'Choose a room type for this property.'); end if;
  if not exists (select 1 from public.rate_plans where id = p_rate_plan and property_id = p_property and is_active) then
    perform app.fail('E_INVALID', 'Choose a rate plan for this property.'); end if;
  if coalesce(p_adults, 0) < 1 then perform app.fail('E_INVALID', 'At least one adult is required.'); end if;
  if p_adults > rt.max_adults then perform app.fail('E_INVALID', rt.name || ' takes at most ' || rt.max_adults || ' adults.'); end if;
  if coalesce(p_children, 0) < 0 or p_children > rt.max_children then
    perform app.fail('E_INVALID', rt.name || ' takes at most ' || rt.max_children || ' children.'); end if;
end $$;

create or replace function app.policy_amount(p_type text, p_value numeric, p_res uuid)
returns numeric language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_total numeric;
begin
  select coalesce(sum(rate_amount), 0) into v_total from public.reservation_nights where reservation_id = p_res;
  return case p_type
    when 'nights' then (select coalesce(sum(x.rate_amount), 0) from (
        select rate_amount from public.reservation_nights where reservation_id = p_res
        order by stay_date limit ceil(coalesce(p_value, 0))::int) x)
    when 'percent' then round(v_total * coalesce(p_value, 0) / 100, 2)
    when 'amount' then coalesce(p_value, 0)
    else 0 end;
end $$;

create or replace function app.rebuild_nights(p_res uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; rp public.rate_plans; d date; v_amt numeric; v_cur text; v_total numeric := 0;
begin
  select * into r from public.reservations where id = p_res;
  delete from public.reservation_nights where reservation_id = p_res;
  for d in select g::date from generate_series(r.arrival_date, r.departure_date - 1, interval '1 day') g loop
    select p.amount, p.currency into v_amt, v_cur from public.rate_plan_prices p
    where p.rate_plan_id = r.rate_plan_id and p.room_type_id = r.room_type_id and d between p.valid_from and p.valid_to
    limit 1;
    if v_amt is null then
      perform app.fail('E_NO_RATE', 'No price is set for this rate plan and room type on ' || to_char(d, 'DD Mon YYYY') || '.');
    end if;
    if r.rate_override is not null then v_amt := r.rate_override; end if;
    insert into public.reservation_nights(tenant_id, property_id, reservation_id, room_type_id, stay_date, rate_amount, room_id)
    values (r.tenant_id, r.property_id, r.id, r.room_type_id, d, v_amt,
      (select a.room_id from public.room_assignments a
        where a.reservation_id = r.id and a.is_active and d >= a.from_date and d < a.to_date limit 1));
    v_total := v_total + v_amt;
  end loop;
  select * into rp from public.rate_plans where id = r.rate_plan_id;
  update public.reservations set total_amount = v_total, currency = coalesce(v_cur, currency),
    deposit_required = app.policy_amount(rp.deposit_policy_type, rp.deposit_policy_value, p_res), updated_at = now()
  where id = p_res;
end $$;

create or replace function app.reservation_for_write(p_id uuid, p_perm text)
returns public.reservations language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations;
begin
  select * into r from public.reservations where id = p_id and tenant_id = app.my_tenant() for update;
  if r.id is null then perform app.fail('E_NOT_FOUND', 'Reservation not found.'); end if;
  perform app.require(p_perm, r.property_id);
  return r;
end $$;

create or replace function app.release_rooms(p_res uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.room_assignments set is_active = false, released_at = now() where reservation_id = p_res and is_active;
  update public.reservation_nights set room_id = null where reservation_id = p_res and room_id is not null;
end $$;

create or replace function app.log_res(r public.reservations, p_action text, p_reason text, p_after jsonb default null)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after, reason)
  values (r.tenant_id, auth.uid(), p_action, 'reservations', r.id::text, p_after, nullif(btrim(p_reason), ''));
$$;

create or replace function app.check_override(p_property uuid, p_override numeric, p_reason text)
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if p_override is null then return; end if;
  if not app.can('res.rate.override', p_property) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to override the rate.'); end if;
  if p_override < 0 then perform app.fail('E_INVALID', 'The nightly rate cannot be negative.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required to override the rate.'); end if;
end $$;

create or replace function public.get_availability(p_property_id uuid, p_arrival date, p_departure date)
returns table(room_type_id uuid, room_type_code text, room_type_name text, stay_date date,
              sellable integer, reserved integer, available integer)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not app.can('res.view', p_property_id) then perform app.fail('E_FORBIDDEN', 'You do not have permission to view reservations.'); end if;
  if p_arrival is null or p_departure is null or p_departure <= p_arrival then
    perform app.fail('E_INVALID', 'Departure must be after arrival.'); end if;
  if p_departure - p_arrival > 62 then perform app.fail('E_INVALID', 'Show at most 62 nights at a time.'); end if;
  return query
  select a.room_type_id, rt.code, rt.name, a.stay_date, a.sellable, a.reserved, a.sellable - a.reserved
  from app.availability(p_property_id, p_arrival, p_departure, null) a
  join public.room_types rt on rt.id = a.room_type_id
  order by rt.code, a.stay_date;
end $$;

create or replace function public.save_group_booking(p_property_id uuid, p_id uuid, p_name text,
  p_contact_name text, p_contact_phone text, p_notes text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  perform app.require('res.group.manage', p_property_id);
  if coalesce(btrim(p_name), '') = '' then perform app.fail('E_REQUIRED', 'Group name is required.'); end if;
  if p_id is null then
    insert into public.group_bookings(tenant_id, property_id, name, contact_name, contact_phone, notes)
    select tenant_id, id, btrim(p_name), nullif(btrim(p_contact_name), ''), nullif(btrim(p_contact_phone), ''), nullif(btrim(p_notes), '')
    from public.properties where id = p_property_id returning id into v_id;
  else
    update public.group_bookings set name = btrim(p_name), contact_name = nullif(btrim(p_contact_name), ''),
      contact_phone = nullif(btrim(p_contact_phone), ''), notes = nullif(btrim(p_notes), '')
    where id = p_id and property_id = p_property_id returning id into v_id;
    if v_id is null then perform app.fail('E_NOT_FOUND', 'Group not found.'); end if;
  end if;
  return v_id;
end $$;

create or replace function public.create_reservation(
  p_property_id uuid, p_idempotency_key text, p_guest_id uuid, p_arrival date, p_departure date,
  p_room_type_id uuid, p_rate_plan_id uuid, p_adults integer, p_children integer,
  p_status text default 'confirmed', p_source text default 'direct', p_company_name text default null,
  p_special_requests text default null, p_notes text default null, p_guarantee text default 'none',
  p_hold_until timestamptz default null, p_group_id uuid default null,
  p_rate_override numeric default null, p_override_reason text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid := app.my_tenant(); v_id uuid; v_hold timestamptz; p public.properties; v_number text;
begin
  perform app.require('res.create', p_property_id);
  if coalesce(btrim(p_idempotency_key), '') = '' then perform app.fail('E_REQUIRED', 'An idempotency key is required.'); end if;
  perform pg_advisory_xact_lock(hashtextextended('res-idem:' || v_tenant::text || ':' || p_idempotency_key, 0));
  select id into v_id from public.reservations where tenant_id = v_tenant and idempotency_key = btrim(p_idempotency_key);
  if v_id is not null then return v_id; end if;

  select * into p from public.properties where id = p_property_id;
  perform app.guest_for_write(p_guest_id);
  if p_status not in ('tentative', 'confirmed') then perform app.fail('E_INVALID', 'New bookings must be tentative or confirmed.'); end if;
  if p_source not in ('direct','walk_in','phone','corporate','other') then perform app.fail('E_INVALID', 'Choose a source.'); end if;
  if p_guarantee not in ('none','card','deposit','company','other') then perform app.fail('E_INVALID', 'Choose a guarantee.'); end if;
  perform app.validate_stay(p_property_id, p_arrival, p_departure, p_room_type_id, p_rate_plan_id, p_adults, p_children);
  if p_arrival < p.business_date then perform app.fail('E_INVALID', 'Arrival cannot be before the business date.'); end if;
  perform app.check_override(p_property_id, p_rate_override, p_override_reason);
  if p_group_id is not null and not exists (select 1 from public.group_bookings where id = p_group_id and property_id = p_property_id and status = 'active') then
    perform app.fail('E_INVALID', 'Choose a group for this property.'); end if;
  if p_status = 'tentative' then
    v_hold := coalesce(p_hold_until, now() + make_interval(hours => p.tentative_hold_hours));
    if v_hold <= now() then perform app.fail('E_INVALID', 'The hold time must be in the future.'); end if;
  end if;

  perform app.assert_available(p_property_id, p_room_type_id, p_arrival, p_departure, null);
  v_number := app.next_document_number(p_property_id, 'reservation');
  perform set_config('app.audit_reason', coalesce(btrim(p_override_reason), ''), true);

  insert into public.reservations(tenant_id, property_id, number, guest_id, arrival_date, departure_date, room_type_id,
    rate_plan_id, adults, children, status, source, company_name, special_requests, notes, guarantee, hold_until,
    group_id, idempotency_key, rate_override, override_reason)
  values (v_tenant, p_property_id, v_number, p_guest_id, p_arrival, p_departure, p_room_type_id, p_rate_plan_id,
    p_adults, coalesce(p_children, 0), p_status, p_source, nullif(btrim(p_company_name), ''),
    nullif(btrim(p_special_requests), ''), nullif(btrim(p_notes), ''), p_guarantee, v_hold, p_group_id,
    btrim(p_idempotency_key), p_rate_override, case when p_rate_override is null then null else btrim(p_override_reason) end)
  returning id into v_id;

  perform app.rebuild_nights(v_id);
  insert into public.reservation_guests(reservation_id, guest_id, tenant_id, is_primary) values (v_id, p_guest_id, v_tenant, true);
  perform set_config('app.audit_reason', '', true);
  return v_id;
end $$;

create or replace function public.modify_reservation(
  p_id uuid, p_arrival date, p_departure date, p_room_type_id uuid, p_rate_plan_id uuid,
  p_adults integer, p_children integer, p_source text, p_company_name text, p_special_requests text,
  p_notes text, p_guarantee text, p_hold_until timestamptz, p_group_id uuid,
  p_rate_override numeric, p_override_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; v_bdate date; v_stay_changed boolean;
begin
  r := app.reservation_for_write(p_id, 'res.edit');
  if r.status not in ('tentative', 'confirmed') then perform app.fail('E_INVALID', 'Only tentative or confirmed bookings can be changed.'); end if;
  if p_source not in ('direct','walk_in','phone','corporate','other') then perform app.fail('E_INVALID', 'Choose a source.'); end if;
  if p_guarantee not in ('none','card','deposit','company','other') then perform app.fail('E_INVALID', 'Choose a guarantee.'); end if;
  perform app.validate_stay(r.property_id, p_arrival, p_departure, p_room_type_id, p_rate_plan_id, p_adults, p_children);
  select business_date into v_bdate from public.properties where id = r.property_id;
  if p_arrival <> r.arrival_date and p_arrival < v_bdate then perform app.fail('E_INVALID', 'Arrival cannot be before the business date.'); end if;
  if p_rate_override is distinct from r.rate_override then
    perform app.check_override(r.property_id, p_rate_override, p_override_reason);
  end if;
  if p_group_id is not null and not exists (select 1 from public.group_bookings where id = p_group_id and property_id = r.property_id) then
    perform app.fail('E_INVALID', 'Choose a group for this property.'); end if;
  if r.status = 'tentative' and p_hold_until is not null and p_hold_until <= now() and p_hold_until is distinct from r.hold_until then
    perform app.fail('E_INVALID', 'The hold time must be in the future.'); end if;

  v_stay_changed := p_arrival <> r.arrival_date or p_departure <> r.departure_date or p_room_type_id <> r.room_type_id;
  if v_stay_changed then
    perform app.release_rooms(p_id);
    perform app.assert_available(r.property_id, p_room_type_id, p_arrival, p_departure, p_id);
  end if;

  perform set_config('app.audit_reason', case when p_rate_override is distinct from r.rate_override then coalesce(btrim(p_override_reason), '') else '' end, true);
  update public.reservations set arrival_date = p_arrival, departure_date = p_departure, room_type_id = p_room_type_id,
    rate_plan_id = p_rate_plan_id, adults = p_adults, children = coalesce(p_children, 0), source = p_source,
    company_name = nullif(btrim(p_company_name), ''), special_requests = nullif(btrim(p_special_requests), ''),
    notes = nullif(btrim(p_notes), ''), guarantee = p_guarantee,
    hold_until = case when r.status = 'tentative' then coalesce(p_hold_until, r.hold_until) else null end,
    group_id = p_group_id, rate_override = p_rate_override,
    override_reason = case when p_rate_override is null then null
                           when p_rate_override is distinct from r.rate_override then btrim(p_override_reason)
                           else r.override_reason end,
    updated_at = now()
  where id = p_id;
  perform app.rebuild_nights(p_id);
  perform set_config('app.audit_reason', '', true);
end $$;

create or replace function public.confirm_reservation(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations;
begin
  r := app.reservation_for_write(p_id, 'res.edit');
  if r.status <> 'tentative' then perform app.fail('E_INVALID', 'Only tentative bookings can be confirmed.'); end if;
  if r.hold_until is not null and r.hold_until <= now() then
    perform app.assert_available(r.property_id, r.room_type_id, r.arrival_date, r.departure_date, p_id);
  end if;
  update public.reservations set status = 'confirmed', hold_until = null, updated_at = now() where id = p_id;
end $$;

create or replace function public.cancel_reservation(p_id uuid, p_reason text, p_waive_fee boolean default false, p_waive_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; rp public.rate_plans; v_fee numeric;
begin
  r := app.reservation_for_write(p_id, 'res.cancel');
  if r.status not in ('tentative', 'confirmed') then perform app.fail('E_INVALID', 'Only tentative or confirmed bookings can be cancelled.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  if coalesce(p_waive_fee, false) and coalesce(btrim(p_waive_reason), '') = '' then
    perform app.fail('E_REQUIRED', 'A reason is required to waive the fee.'); end if;
  select * into rp from public.rate_plans where id = r.rate_plan_id;
  v_fee := app.policy_amount(rp.cancellation_policy_type, rp.cancellation_policy_value, p_id);
  perform set_config('app.audit_reason', btrim(p_reason), true);
  perform app.release_rooms(p_id);
  update public.reservations set status = 'cancelled', cancellation_fee = v_fee, fee_waived = coalesce(p_waive_fee, false),
    status_reason = btrim(p_reason), cancelled_at = now(), hold_until = null, updated_at = now()
  where id = p_id;
  if coalesce(p_waive_fee, false) and v_fee > 0 then
    perform app.log_res(r, 'waive_cancellation_fee', p_waive_reason, jsonb_build_object('fee', v_fee));
  end if;
  perform set_config('app.audit_reason', '', true);
  return jsonb_build_object('fee', v_fee, 'waived', coalesce(p_waive_fee, false),
    'charged', case when coalesce(p_waive_fee, false) then 0 else v_fee end, 'currency', r.currency);
end $$;

create or replace function public.mark_no_show(p_id uuid, p_reason text, p_waive_fee boolean default false, p_waive_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; rp public.rate_plans; v_fee numeric; v_bdate date;
begin
  r := app.reservation_for_write(p_id, 'res.noshow');
  if r.status not in ('tentative', 'confirmed') then perform app.fail('E_INVALID', 'Only tentative or confirmed bookings can be marked as no-show.'); end if;
  select business_date into v_bdate from public.properties where id = r.property_id;
  if r.arrival_date > v_bdate then perform app.fail('E_INVALID', 'You can mark a no-show only on or after the arrival date.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  if coalesce(p_waive_fee, false) and coalesce(btrim(p_waive_reason), '') = '' then
    perform app.fail('E_REQUIRED', 'A reason is required to waive the fee.'); end if;
  select * into rp from public.rate_plans where id = r.rate_plan_id;
  v_fee := app.policy_amount(rp.no_show_policy_type, rp.no_show_policy_value, p_id);
  perform set_config('app.audit_reason', btrim(p_reason), true);
  perform app.release_rooms(p_id);
  update public.reservations set status = 'no_show', no_show_fee = v_fee, fee_waived = coalesce(p_waive_fee, false),
    status_reason = btrim(p_reason), hold_until = null, updated_at = now()
  where id = p_id;
  if coalesce(p_waive_fee, false) and v_fee > 0 then
    perform app.log_res(r, 'waive_no_show_fee', p_waive_reason, jsonb_build_object('fee', v_fee));
  end if;
  perform set_config('app.audit_reason', '', true);
  return jsonb_build_object('fee', v_fee, 'waived', coalesce(p_waive_fee, false),
    'charged', case when coalesce(p_waive_fee, false) then 0 else v_fee end, 'currency', r.currency);
end $$;

create or replace function public.reinstate_reservation(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; v_bdate date;
begin
  r := app.reservation_for_write(p_id, 'res.edit');
  if r.status not in ('cancelled', 'no_show') then perform app.fail('E_INVALID', 'Only cancelled or no-show bookings can be reinstated.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  select business_date into v_bdate from public.properties where id = r.property_id;
  if r.departure_date <= v_bdate then perform app.fail('E_INVALID', 'This stay is already in the past.'); end if;
  perform app.assert_available(r.property_id, r.room_type_id, r.arrival_date, r.departure_date, p_id);
  perform set_config('app.audit_reason', btrim(p_reason), true);
  update public.reservations set status = 'confirmed', cancellation_fee = null, no_show_fee = null, fee_waived = false,
    status_reason = btrim(p_reason), cancelled_at = null, updated_at = now()
  where id = p_id;
  perform set_config('app.audit_reason', '', true);
end $$;

create or replace function public.get_assignable_rooms(p_id uuid)
returns table(id uuid, room_number text, floor text, condition text, is_occupied boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r public.reservations;
begin
  select * into r from public.reservations x where x.id = p_id and x.tenant_id = app.my_tenant();
  if r.id is null or not app.can('res.view', r.property_id) then perform app.fail('E_NOT_FOUND', 'Reservation not found.'); end if;
  return query
  select rm.id, rm.room_number, rm.floor, rm.condition, rm.is_occupied
  from public.rooms rm
  where rm.room_type_id = r.room_type_id and rm.is_active and rm.condition <> 'out_of_order'
    and not exists (select 1 from public.room_assignments a
      where a.room_id = rm.id and a.is_active and a.reservation_id <> r.id
        and daterange(a.from_date, a.to_date, '[)') && daterange(r.arrival_date, r.departure_date, '[)'))
  order by length(rm.room_number), rm.room_number;
end $$;

create or replace function public.assign_room(p_id uuid, p_room_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; rm public.rooms;
begin
  r := app.reservation_for_write(p_id, 'res.edit');
  if r.status not in ('tentative', 'confirmed') then perform app.fail('E_INVALID', 'Rooms can be assigned only to tentative or confirmed bookings.'); end if;
  select * into rm from public.rooms where id = p_room_id and property_id = r.property_id;
  if rm.id is null then perform app.fail('E_NOT_FOUND', 'Room not found.'); end if;
  if rm.room_type_id <> r.room_type_id then perform app.fail('E_INVALID', 'The room must be of the booked room type.'); end if;
  if not rm.is_active or rm.condition = 'out_of_order' then perform app.fail('E_INVALID', 'Room ' || rm.room_number || ' cannot be used right now.'); end if;
  perform app.release_rooms(p_id);
  begin
    insert into public.room_assignments(tenant_id, property_id, reservation_id, room_id, from_date, to_date)
    values (r.tenant_id, r.property_id, p_id, p_room_id, r.arrival_date, r.departure_date);
    update public.reservation_nights set room_id = p_room_id where reservation_id = p_id;
  exception when exclusion_violation or unique_violation then
    perform app.fail('E_ROOM_TAKEN', 'Room ' || rm.room_number || ' is already assigned to another stay on these dates.');
  end;
  perform app.log_res(r, 'assign_room', null, jsonb_build_object('room_id', p_room_id, 'room_number', rm.room_number));
end $$;

create or replace function public.unassign_room(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations;
begin
  r := app.reservation_for_write(p_id, 'res.edit');
  if r.status not in ('tentative', 'confirmed') then perform app.fail('E_INVALID', 'Rooms can be removed only from tentative or confirmed bookings.'); end if;
  perform app.release_rooms(p_id);
  perform app.log_res(r, 'unassign_room', null, null);
end $$;

create or replace function public.set_reservation_guests(p_id uuid, p_primary_guest_id uuid, p_guest_ids uuid[])
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; v_ids uuid[]; g uuid;
begin
  r := app.reservation_for_write(p_id, 'res.edit');
  if r.status in ('cancelled', 'no_show', 'checked_out') then perform app.fail('E_INVALID', 'Guests cannot be changed on this booking.'); end if;
  if p_primary_guest_id is null then perform app.fail('E_REQUIRED', 'Choose the main guest.'); end if;
  select array_agg(distinct x) into v_ids from unnest(coalesce(p_guest_ids, '{}'::uuid[]) || p_primary_guest_id) x where x is not null;
  if array_length(v_ids, 1) > r.adults + r.children then
    perform app.fail('E_INVALID', 'This booking is for ' || (r.adults + r.children) || ' people.'); end if;
  foreach g in array v_ids loop perform app.guest_for_write(g); end loop;
  delete from public.reservation_guests where reservation_id = p_id;
  insert into public.reservation_guests(reservation_id, guest_id, tenant_id, is_primary)
  select p_id, x, r.tenant_id, x = p_primary_guest_id from unnest(v_ids) x;
  update public.reservations set guest_id = p_primary_guest_id, updated_at = now() where id = p_id;
  perform app.log_res(r, 'set_reservation_guests', null, jsonb_build_object('primary', p_primary_guest_id, 'guests', to_jsonb(v_ids)));
end $$;

create or replace function public.search_reservations(p_property_id uuid, p_query text default '', p_status text default null,
  p_from date default null, p_to date default null, p_limit integer default 100)
returns table(id uuid, number text, guest_id uuid, guest_name text, arrival_date date, departure_date date,
  room_type_code text, room_number text, status text, source text, company_name text, hold_until timestamptz,
  total_amount numeric, currency text, adults integer, children integer)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_q text := lower(btrim(coalesce(p_query, '')));
begin
  if not app.can('res.view', p_property_id) then perform app.fail('E_FORBIDDEN', 'You do not have permission to view reservations.'); end if;
  return query
  select r.id, r.number, r.guest_id, btrim(g.first_name || ' ' || g.last_name), r.arrival_date, r.departure_date,
    rt.code, (select rm.room_number from public.room_assignments a join public.rooms rm on rm.id = a.room_id
              where a.reservation_id = r.id and a.is_active limit 1),
    r.status, r.source, r.company_name, r.hold_until, r.total_amount::numeric, r.currency::text, r.adults, r.children
  from public.reservations r
  join public.guests g on g.id = r.guest_id
  join public.room_types rt on rt.id = r.room_type_id
  where r.property_id = p_property_id and r.tenant_id = app.my_tenant()
    and (p_status is null or r.status = p_status)
    and (p_from is null or r.departure_date > p_from)
    and (p_to is null or r.arrival_date <= p_to)
    and (v_q = '' or lower(r.number) like '%' || v_q || '%'
      or lower(g.first_name || ' ' || g.last_name) like '%' || v_q || '%'
      or lower(coalesce(r.company_name, '')) like '%' || v_q || '%'
      or lower(coalesce(g.phone, '')) like '%' || v_q || '%')
  order by r.arrival_date, r.number
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end $$;

create or replace function public.get_reservation(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r public.reservations;
begin
  select * into r from public.reservations where id = p_id and tenant_id = app.my_tenant();
  if r.id is null or not app.can('res.view', r.property_id) then perform app.fail('E_NOT_FOUND', 'Reservation not found.'); end if;
  return jsonb_build_object(
    'reservation', to_jsonb(r),
    'room_type', (select jsonb_build_object('id', id, 'code', code, 'name', name, 'max_adults', max_adults, 'max_children', max_children) from public.room_types where id = r.room_type_id),
    'rate_plan', (select to_jsonb(x) from public.rate_plans x where x.id = r.rate_plan_id),
    'group', (select jsonb_build_object('id', id, 'name', name) from public.group_bookings where id = r.group_id),
    'room', (select jsonb_build_object('id', rm.id, 'room_number', rm.room_number, 'condition', rm.condition)
             from public.room_assignments a join public.rooms rm on rm.id = a.room_id where a.reservation_id = r.id and a.is_active limit 1),
    'guests', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'first_name', g.first_name, 'last_name', g.last_name,
        'phone', g.phone, 'email', g.email, 'is_primary', rg.is_primary) order by rg.is_primary desc, g.last_name)
      from public.reservation_guests rg join public.guests g on g.id = rg.guest_id where rg.reservation_id = r.id), '[]'::jsonb),
    'nights', coalesce((select jsonb_agg(jsonb_build_object('stay_date', n.stay_date, 'rate_amount', n.rate_amount, 'room_id', n.room_id) order by n.stay_date)
      from public.reservation_nights n where n.reservation_id = r.id), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'action', e.action, 'before', e.before, 'after', e.after,
        'reason', e.reason, 'created_at', e.created_at, 'actor', p.full_name) order by e.created_at desc)
      from public.audit_events e left join public.profiles p on p.id = e.actor_id
      where e.tenant_id = r.tenant_id and e.table_name = 'reservations' and e.record_id = r.id::text), '[]'::jsonb)
  );
end $$;

create or replace function public.get_guest(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare g public.guests; v_docs boolean;
begin
  if not app.can('guest.view', null) then perform app.fail('E_FORBIDDEN', 'You do not have permission to view guests.'); end if;
  select * into g from public.guests where id = p_id and tenant_id = app.my_tenant();
  if g.id is null then perform app.fail('E_NOT_FOUND', 'Guest not found.'); end if;
  v_docs := app.can('guest.document.view', null);
  return jsonb_build_object(
    'guest', to_jsonb(g),
    'can_view_documents', v_docs,
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'doc_type', d.doc_type, 'expiry', d.expiry,
        'doc_number', case when v_docs then d.doc_number else null end,
        'doc_number_masked', case when length(d.doc_number) > 2 then repeat('•', length(d.doc_number) - 2) || right(d.doc_number, 2) else '••' end
      ) order by d.created_at)
      from public.guest_documents d where d.guest_id = g.id), '[]'::jsonb),
    'feedback', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.created_at desc)
      from public.guest_feedback f where f.guest_id = g.id), '[]'::jsonb),
    'stays', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'number', r.number, 'property_name', pr.name,
        'arrival_date', r.arrival_date, 'departure_date', r.departure_date, 'status', r.status,
        'total_amount', r.total_amount, 'currency', r.currency) order by r.arrival_date desc)
      from public.reservations r join public.properties pr on pr.id = r.property_id
      where r.tenant_id = g.tenant_id and app.can('res.view', r.property_id)
        and (r.guest_id = g.id or exists (select 1 from public.reservation_guests rg where rg.reservation_id = r.id and rg.guest_id = g.id))
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.merge_guests(p_keep uuid, p_remove uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid := app.my_tenant();
begin
  perform app.require_any('guest.merge');
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  if p_keep = p_remove then perform app.fail('E_INVALID', 'Choose two different guests.'); end if;
  perform 1 from public.guests where id in (p_keep, p_remove) and tenant_id = v_tenant for update;
  perform app.guest_for_write(p_keep);
  perform app.guest_for_write(p_remove);
  perform set_config('app.audit_reason', btrim(p_reason), true);

  update public.guest_documents set guest_id = p_keep where guest_id = p_remove;
  update public.guest_feedback set guest_id = p_keep where guest_id = p_remove;
  update public.reservations set guest_id = p_keep where guest_id = p_remove;
  delete from public.reservation_guests rg where rg.guest_id = p_remove
    and exists (select 1 from public.reservation_guests k where k.reservation_id = rg.reservation_id and k.guest_id = p_keep);
  update public.reservation_guests set guest_id = p_keep where guest_id = p_remove;
  update public.reservation_guests rg set is_primary = true from public.reservations r
    where r.id = rg.reservation_id and r.guest_id = p_keep and rg.guest_id = p_keep;
  update public.guests set status = 'merged', merged_into = p_keep, updated_at = now() where id = p_remove;

  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after, reason)
  values (v_tenant, auth.uid(), 'merge_guests', 'guests', p_keep::text,
          jsonb_build_object('kept', p_keep, 'removed', p_remove), btrim(p_reason));
  perform set_config('app.audit_reason', '', true);
end $$;

revoke all on function app.availability(uuid, date, date, uuid), app.assert_available(uuid, uuid, date, date, uuid),
  app.validate_stay(uuid, date, date, uuid, uuid, integer, integer), app.policy_amount(text, numeric, uuid),
  app.rebuild_nights(uuid), app.reservation_for_write(uuid, text), app.release_rooms(uuid),
  app.log_res(public.reservations, text, text, jsonb), app.check_override(uuid, numeric, text) from public;

revoke all on function
  public.get_availability(uuid, date, date),
  public.save_group_booking(uuid, uuid, text, text, text, text),
  public.create_reservation(uuid, text, uuid, date, date, uuid, uuid, integer, integer, text, text, text, text, text, text, timestamptz, uuid, numeric, text),
  public.modify_reservation(uuid, date, date, uuid, uuid, integer, integer, text, text, text, text, text, timestamptz, uuid, numeric, text),
  public.confirm_reservation(uuid),
  public.cancel_reservation(uuid, text, boolean, text),
  public.mark_no_show(uuid, text, boolean, text),
  public.reinstate_reservation(uuid, text),
  public.get_assignable_rooms(uuid),
  public.assign_room(uuid, uuid),
  public.unassign_room(uuid),
  public.set_reservation_guests(uuid, uuid, uuid[]),
  public.search_reservations(uuid, text, text, date, date, integer),
  public.get_reservation(uuid)
from public, anon;

grant execute on function
  public.get_availability(uuid, date, date),
  public.save_group_booking(uuid, uuid, text, text, text, text),
  public.create_reservation(uuid, text, uuid, date, date, uuid, uuid, integer, integer, text, text, text, text, text, text, timestamptz, uuid, numeric, text),
  public.modify_reservation(uuid, date, date, uuid, uuid, integer, integer, text, text, text, text, text, timestamptz, uuid, numeric, text),
  public.confirm_reservation(uuid),
  public.cancel_reservation(uuid, text, boolean, text),
  public.mark_no_show(uuid, text, boolean, text),
  public.reinstate_reservation(uuid, text),
  public.get_assignable_rooms(uuid),
  public.assign_room(uuid, uuid),
  public.unassign_room(uuid),
  public.set_reservation_guests(uuid, uuid, uuid[]),
  public.search_reservations(uuid, text, text, date, date, integer),
  public.get_reservation(uuid)
to authenticated, service_role;

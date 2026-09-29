-- =====================================================================
-- Setup: room types, rooms, rate plans & prices, taxes, charge codes,
-- payment methods, exchange rates, document sequences, plan limits.
-- =====================================================================

-- Permission + writability guard used by every setup function.
create or replace function app.require(p_permission_key text, p_property_id uuid)
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform app.assert_writable(false);
  if not app.can(p_permission_key, p_property_id) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to do this.');
  end if;
end $$;
revoke all on function app.require(text, uuid) from public;
grant execute on function app.require(text, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table public.room_types (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  property_id   uuid not null references public.properties(id) on delete cascade,
  code          text not null,
  name          text not null,
  max_adults    integer not null default 2 check (max_adults >= 1),
  max_children  integer not null default 0 check (max_children >= 0),
  description   text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (property_id, code)
);

create table public.rooms (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  property_id   uuid not null references public.properties(id) on delete cascade,
  room_number   text not null,
  room_type_id  uuid not null references public.room_types(id),
  floor         text,
  condition     text not null default 'clean' check (condition in ('clean','dirty','inspected','out_of_order')),
  is_occupied   boolean not null default false,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (property_id, room_number)
);
create index rooms_tenant_idx on public.rooms(tenant_id);

create table public.rate_plans (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete cascade,
  property_id                 uuid not null references public.properties(id) on delete cascade,
  code                        text not null,
  name                        text not null,
  is_corporate                boolean not null default false,
  cancellation_policy_type    text not null default 'none' check (cancellation_policy_type in ('none','nights','percent','amount')),
  cancellation_policy_value   numeric(20,4) not null default 0 check (cancellation_policy_value >= 0),
  no_show_policy_type         text not null default 'none' check (no_show_policy_type in ('none','nights','percent','amount')),
  no_show_policy_value        numeric(20,4) not null default 0 check (no_show_policy_value >= 0),
  deposit_policy_type         text not null default 'none' check (deposit_policy_type in ('none','nights','percent','amount')),
  deposit_policy_value        numeric(20,4) not null default 0 check (deposit_policy_value >= 0),
  is_active                   boolean not null default true,
  created_at                  timestamptz not null default now(),
  unique (property_id, code)
);

create table public.rate_plan_prices (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  property_id   uuid not null references public.properties(id) on delete cascade,
  rate_plan_id  uuid not null references public.rate_plans(id) on delete cascade,
  room_type_id  uuid not null references public.room_types(id),
  valid_from    date not null,
  valid_to      date not null,
  amount        numeric(20,4) not null check (amount >= 0),
  currency      char(3) not null default 'NGN',
  created_at    timestamptz not null default now(),
  check (valid_to >= valid_from)
);
create index rate_plan_prices_lookup on public.rate_plan_prices(rate_plan_id, room_type_id, valid_from);

create table public.tax_rates (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants(id) on delete cascade,
  property_id            uuid not null references public.properties(id) on delete cascade,
  code                   text not null,
  name                   text not null,
  percent                numeric(9,4) not null check (percent >= 0 and percent <= 100),
  sort_order             integer not null default 1,
  compounds_on_previous  boolean not null default false,
  description            text,
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  unique (property_id, code)
);

create table public.charge_codes (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  code         text not null,
  name         text not null,
  category     text not null check (category in ('room','food','service','tax','other')),
  is_taxable   boolean not null default true,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (property_id, code)
);

create table public.payment_methods (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  code         text not null,
  name         text not null,
  kind         text not null check (kind in ('cash','card','transfer','pos','other')),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (property_id, code)
);

create table public.exchange_rates (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  currency     char(3) not null check (currency ~ '^[A-Z]{3}$'),
  rate_date    date not null,
  rate         numeric(20,8) not null check (rate > 0), -- units of base currency per 1 unit of currency
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (property_id, currency, rate_date)
);

create table public.document_sequences (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  doc_type     text not null check (doc_type in ('reservation','folio','invoice')),
  prefix       text not null default '',
  next_number  bigint not null default 1 check (next_number >= 1),
  padding      integer not null default 6 check (padding between 1 and 12),
  unique (property_id, doc_type)
);

-- ---------------------------------------------------------------------
-- Grants: read via RLS; all writes go through functions.
-- ---------------------------------------------------------------------
grant select on public.room_types, public.rooms, public.rate_plans, public.rate_plan_prices,
  public.tax_rates, public.charge_codes, public.payment_methods, public.exchange_rates,
  public.document_sequences to authenticated;
grant all on public.room_types, public.rooms, public.rate_plans, public.rate_plan_prices,
  public.tax_rates, public.charge_codes, public.payment_methods, public.exchange_rates,
  public.document_sequences to service_role;

alter table public.room_types enable row level security;
alter table public.rooms enable row level security;
alter table public.rate_plans enable row level security;
alter table public.rate_plan_prices enable row level security;
alter table public.tax_rates enable row level security;
alter table public.charge_codes enable row level security;
alter table public.payment_methods enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.document_sequences enable row level security;

create policy room_types_read on public.room_types for select to authenticated
  using (tenant_id = app.my_tenant() and app.has_property_access(property_id));
create policy rooms_read on public.rooms for select to authenticated
  using (tenant_id = app.my_tenant() and app.has_property_access(property_id));
create policy rate_plans_read on public.rate_plans for select to authenticated
  using (tenant_id = app.my_tenant() and app.has_property_access(property_id));
create policy rate_plan_prices_read on public.rate_plan_prices for select to authenticated
  using (tenant_id = app.my_tenant() and app.has_property_access(property_id));
create policy tax_rates_read on public.tax_rates for select to authenticated
  using (tenant_id = app.my_tenant() and app.has_property_access(property_id));
create policy charge_codes_read on public.charge_codes for select to authenticated
  using (tenant_id = app.my_tenant() and app.has_property_access(property_id));
create policy payment_methods_read on public.payment_methods for select to authenticated
  using (tenant_id = app.my_tenant() and app.has_property_access(property_id));
create policy exchange_rates_read on public.exchange_rates for select to authenticated
  using (tenant_id = app.my_tenant() and app.has_property_access(property_id));
create policy document_sequences_read on public.document_sequences for select to authenticated
  using (tenant_id = app.my_tenant() and app.has_property_access(property_id)
         and app.can('setup.property.view', property_id));

-- Read-only enforcement on direct writes
create trigger room_types_enforce_writable before insert or update or delete on public.room_types for each row execute function app.enforce_writable();
create trigger rooms_enforce_writable before insert or update or delete on public.rooms for each row execute function app.enforce_writable();
create trigger rate_plans_enforce_writable before insert or update or delete on public.rate_plans for each row execute function app.enforce_writable();
create trigger rate_plan_prices_enforce_writable before insert or update or delete on public.rate_plan_prices for each row execute function app.enforce_writable();
create trigger tax_rates_enforce_writable before insert or update or delete on public.tax_rates for each row execute function app.enforce_writable();
create trigger charge_codes_enforce_writable before insert or update or delete on public.charge_codes for each row execute function app.enforce_writable();
create trigger payment_methods_enforce_writable before insert or update or delete on public.payment_methods for each row execute function app.enforce_writable();
create trigger exchange_rates_enforce_writable before insert or update or delete on public.exchange_rates for each row execute function app.enforce_writable();

-- ---------------------------------------------------------------------
-- Plan limits
-- ---------------------------------------------------------------------
create or replace function app.enforce_plan_limit()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_limit integer; v_count integer; v_plan text; v_what text;
begin
  if tg_op = 'UPDATE' then
    if tg_table_name = 'rooms' and not (new.is_active and not old.is_active) then return new; end if;
    if tg_table_name = 'profiles' and not (new.status = 'active' and old.status <> 'active') then return new; end if;
  end if;
  if tg_table_name = 'profiles' and new.status <> 'active' then return new; end if;
  if tg_table_name = 'rooms' and not new.is_active then return new; end if;

  -- serialise concurrent adds for this hotel
  perform 1 from public.tenants where id = new.tenant_id for update;

  select pl.name,
         case tg_table_name when 'rooms' then pl.max_rooms
                            when 'properties' then pl.max_properties
                            else pl.max_users end
    into v_plan, v_limit
  from public.tenant_subscriptions s join public.plans pl on pl.code = s.plan_code
  where s.tenant_id = new.tenant_id;
  if v_limit is null then return new; end if;

  if tg_table_name = 'rooms' then
    select count(*) into v_count from public.rooms where tenant_id = new.tenant_id and is_active and id <> new.id;
    v_what := 'rooms';
  elsif tg_table_name = 'properties' then
    select count(*) into v_count from public.properties where tenant_id = new.tenant_id and id <> new.id;
    v_what := 'properties';
  else
    select count(*) into v_count from public.profiles where tenant_id = new.tenant_id and status = 'active' and id <> new.id;
    v_what := 'users';
  end if;

  if v_count >= v_limit then
    perform app.fail('E_PLAN_LIMIT', format('Your %s plan allows up to %s %s. Upgrade your plan to add more.', v_plan, v_limit, v_what));
  end if;
  return new;
end $$;

create trigger rooms_plan_limit before insert or update of is_active on public.rooms
  for each row execute function app.enforce_plan_limit();
create trigger properties_plan_limit before insert on public.properties
  for each row execute function app.enforce_plan_limit();
create trigger profiles_plan_limit before insert or update of status on public.profiles
  for each row execute function app.enforce_plan_limit();

-- ---------------------------------------------------------------------
-- Property defaults
-- ---------------------------------------------------------------------
create or replace function app.seed_property_defaults(p_property_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid; v_country text;
begin
  select tenant_id, lower(coalesce(country, '')) into v_tenant, v_country
  from public.properties where id = p_property_id;
  if v_tenant is null then return; end if;

  insert into public.charge_codes(tenant_id, property_id, code, name, category, is_taxable) values
    (v_tenant, p_property_id, 'ROOM',    'Room charge',      'room',    true),
    (v_tenant, p_property_id, 'REST',    'Restaurant',       'food',    true),
    (v_tenant, p_property_id, 'LAUNDRY', 'Laundry',          'service', true),
    (v_tenant, p_property_id, 'MINIBAR', 'Minibar',          'food',    true),
    (v_tenant, p_property_id, 'SVC',     'Service charge',   'tax',     false),
    (v_tenant, p_property_id, 'VAT',     'VAT',              'tax',     false),
    (v_tenant, p_property_id, 'CXLFEE',  'Cancellation fee', 'other',   false),
    (v_tenant, p_property_id, 'NOSHOW',  'No-show fee',      'other',   false)
  on conflict (property_id, code) do nothing;

  insert into public.payment_methods(tenant_id, property_id, code, name, kind) values
    (v_tenant, p_property_id, 'CASH',     'Cash',          'cash'),
    (v_tenant, p_property_id, 'POS',      'POS',           'pos'),
    (v_tenant, p_property_id, 'TRANSFER', 'Bank transfer', 'transfer'),
    (v_tenant, p_property_id, 'CARD',     'Card',          'card')
  on conflict (property_id, code) do nothing;

  insert into public.document_sequences(tenant_id, property_id, doc_type, prefix) values
    (v_tenant, p_property_id, 'reservation', 'RES-'),
    (v_tenant, p_property_id, 'folio',       'FOL-'),
    (v_tenant, p_property_id, 'invoice',     'INV-')
  on conflict (property_id, doc_type) do nothing;

  if v_country in ('nigeria', 'ng') then
    insert into public.tax_rates(tenant_id, property_id, code, name, percent, sort_order, compounds_on_previous, description) values
      (v_tenant, p_property_id, 'SVC',  'Service charge', 10,  1, false,
        'UNVERIFIED default. 10% of the net price. Confirm with your accountant.'),
      (v_tenant, p_property_id, 'VAT',  'VAT',            7.5, 2, true,
        'UNVERIFIED default. 7.5% of net price plus service charge. Confirm with your accountant.'),
      (v_tenant, p_property_id, 'LEVY', 'State levy',     0,   3, false,
        'UNVERIFIED default. Set your state''s levy rate. Confirm with your accountant.')
    on conflict (property_id, code) do nothing;
  end if;
end $$;

create or replace function app.properties_after_insert()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.seed_property_defaults(new.id);
  return null;
end $$;
create trigger properties_seed_defaults after insert on public.properties
  for each row execute function app.properties_after_insert();

-- Backfill properties created before this migration
select app.seed_property_defaults(id) from public.properties;

-- Next document number (row-locked, gap-free within a transaction)
create or replace function app.next_document_number(p_property_id uuid, p_doc_type text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prefix text; v_num bigint; v_pad int;
begin
  update public.document_sequences
     set next_number = next_number + 1
   where property_id = p_property_id and doc_type = p_doc_type
  returning prefix, next_number - 1, padding into v_prefix, v_num, v_pad;
  if v_num is null then
    perform app.fail('E_NOT_FOUND', 'No number sequence set up for ' || p_doc_type || '.');
  end if;
  return v_prefix || lpad(v_num::text, v_pad, '0');
end $$;
revoke all on function app.next_document_number(uuid, text) from public;
grant execute on function app.next_document_number(uuid, text) to service_role;

-- ---------------------------------------------------------------------
-- Tax calculation
-- ---------------------------------------------------------------------
create or replace function public.calculate_tax(p_property_id uuid, p_amount numeric, p_tax_inclusive boolean default false)
returns table (line_no integer, tax_code text, tax_name text, percent numeric, taxable_base numeric, amount numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  r record;
  v_codes text[] := '{}'; v_names text[] := '{}'; v_pcts numeric[] := '{}'; v_comp boolean[] := '{}';
  v_bases numeric[] := '{}'; v_amts numeric[] := '{}';
  v_mult numeric := 0; v_prev numeric := 0; v_base numeric; v_t numeric;
  v_net numeric; v_target numeric; v_sum numeric := 0; n int; i int;
begin
  if auth.uid() is not null and not app.has_property_access(p_property_id) then
    perform app.fail('E_FORBIDDEN', 'You do not have access to this property.');
  end if;
  if p_amount is null or p_amount < 0 then
    perform app.fail('E_INVALID', 'Amount must be zero or more.');
  end if;

  for r in select t.code, t.name, t.percent, t.compounds_on_previous
           from public.tax_rates t
           where t.property_id = p_property_id and t.is_active
           order by t.sort_order, t.code loop
    v_codes := v_codes || r.code; v_names := v_names || r.name;
    v_pcts := v_pcts || r.percent; v_comp := v_comp || r.compounds_on_previous;
  end loop;
  n := coalesce(array_length(v_codes, 1), 0);
  if n = 0 then return; end if;

  -- tax per 1 unit of net
  for i in 1..n loop
    v_base := 1 + case when v_comp[i] then v_prev else 0 end;
    v_prev := v_prev + v_base * v_pcts[i] / 100;
  end loop;
  v_mult := v_prev;

  if p_tax_inclusive then
    v_net := p_amount / (1 + v_mult);
    v_target := round(p_amount, 2) - round(v_net, 2);
  else
    v_net := p_amount;
    v_target := round(v_net * v_mult, 2);
  end if;

  v_prev := 0;
  for i in 1..n loop
    v_base := v_net + case when v_comp[i] then v_prev else 0 end;
    v_t := v_base * v_pcts[i] / 100;
    v_prev := v_prev + v_t;
    v_bases := v_bases || round(v_base, 2);
    v_amts := v_amts || round(v_t, 2);
    v_sum := v_sum + round(v_t, 2);
  end loop;
  v_amts[n] := v_amts[n] + (v_target - v_sum);  -- rounding remainder on the last line

  for i in 1..n loop
    line_no := i; tax_code := v_codes[i]; tax_name := v_names[i]; percent := v_pcts[i];
    taxable_base := v_bases[i]; amount := v_amts[i];
    return next;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Setup functions (all writes go through these)
-- ---------------------------------------------------------------------
create or replace function public.update_property(
  p_property_id uuid, p_name text, p_address text, p_city text, p_country text,
  p_timezone text, p_check_in_time time, p_check_out_time time)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.require('setup.property.edit', p_property_id);
  if coalesce(btrim(p_name), '') = '' then perform app.fail('E_REQUIRED', 'Property name is required.'); end if;
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    perform app.fail('E_INVALID', 'Unknown time zone.');
  end if;
  update public.properties set
    name = btrim(p_name), address = nullif(btrim(p_address), ''), city = nullif(btrim(p_city), ''),
    country = nullif(btrim(p_country), ''), timezone = p_timezone,
    check_in_time = p_check_in_time, check_out_time = p_check_out_time
  where id = p_property_id;
end $$;

create or replace function public.save_room_type(
  p_property_id uuid, p_id uuid, p_code text, p_name text, p_max_adults integer,
  p_max_children integer, p_description text, p_is_active boolean)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_tenant uuid;
begin
  perform app.require('setup.room.manage', p_property_id);
  if coalesce(btrim(p_code), '') = '' or coalesce(btrim(p_name), '') = '' then
    perform app.fail('E_REQUIRED', 'Code and name are required.'); end if;
  select tenant_id into v_tenant from public.properties where id = p_property_id;
  begin
    if p_id is null then
      insert into public.room_types(tenant_id, property_id, code, name, max_adults, max_children, description, is_active)
      values (v_tenant, p_property_id, upper(btrim(p_code)), btrim(p_name), p_max_adults, p_max_children,
              nullif(btrim(p_description), ''), coalesce(p_is_active, true))
      returning id into v_id;
    else
      update public.room_types set code = upper(btrim(p_code)), name = btrim(p_name), max_adults = p_max_adults,
        max_children = p_max_children, description = nullif(btrim(p_description), ''), is_active = coalesce(p_is_active, true)
      where id = p_id and property_id = p_property_id returning id into v_id;
      if v_id is null then perform app.fail('E_NOT_FOUND', 'Room type not found.'); end if;
    end if;
  exception when unique_violation then
    perform app.fail('E_DUPLICATE', 'That room type code is already used.');
  end;
  return v_id;
end $$;

create or replace function public.save_room(
  p_property_id uuid, p_id uuid, p_room_number text, p_room_type_id uuid, p_floor text, p_is_active boolean)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_tenant uuid;
begin
  perform app.require('setup.room.manage', p_property_id);
  if coalesce(btrim(p_room_number), '') = '' then perform app.fail('E_REQUIRED', 'Room number is required.'); end if;
  if not exists (select 1 from public.room_types where id = p_room_type_id and property_id = p_property_id) then
    perform app.fail('E_INVALID', 'Choose a room type for this property.'); end if;
  select tenant_id into v_tenant from public.properties where id = p_property_id;
  begin
    if p_id is null then
      insert into public.rooms(tenant_id, property_id, room_number, room_type_id, floor, is_active)
      values (v_tenant, p_property_id, btrim(p_room_number), p_room_type_id, nullif(btrim(p_floor), ''), coalesce(p_is_active, true))
      returning id into v_id;
    else
      update public.rooms set room_number = btrim(p_room_number), room_type_id = p_room_type_id,
        floor = nullif(btrim(p_floor), ''), is_active = coalesce(p_is_active, true)
      where id = p_id and property_id = p_property_id returning id into v_id;
      if v_id is null then perform app.fail('E_NOT_FOUND', 'Room not found.'); end if;
    end if;
  exception when unique_violation then
    perform app.fail('E_DUPLICATE', 'That room number already exists.');
  end;
  return v_id;
end $$;

-- Adds rooms p_from..p_to (e.g. 101..120). Existing numbers are skipped. Returns rooms created.
create or replace function public.bulk_add_rooms(
  p_property_id uuid, p_from integer, p_to integer, p_room_type_id uuid, p_floor text default null)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid; v_count integer;
begin
  perform app.require('setup.room.manage', p_property_id);
  if p_from is null or p_to is null or p_from < 0 or p_to < p_from then
    perform app.fail('E_INVALID', 'Enter a valid range, e.g. 101 to 120.'); end if;
  if p_to - p_from + 1 > 500 then
    perform app.fail('E_INVALID', 'You can add at most 500 rooms at a time.'); end if;
  if not exists (select 1 from public.room_types where id = p_room_type_id and property_id = p_property_id) then
    perform app.fail('E_INVALID', 'Choose a room type for this property.'); end if;
  select tenant_id into v_tenant from public.properties where id = p_property_id;

  insert into public.rooms(tenant_id, property_id, room_number, room_type_id, floor)
  select v_tenant, p_property_id, g::text, p_room_type_id, nullif(btrim(p_floor), '')
  from generate_series(p_from, p_to) g
  where not exists (select 1 from public.rooms r where r.property_id = p_property_id and r.room_number = g::text)
  order by g;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function app.check_policy(p_label text, p_type text, p_value numeric)
returns void language plpgsql immutable as $$
begin
  if p_type not in ('none','nights','percent','amount') then
    perform app.fail('E_INVALID', p_label || ' type is not valid.'); end if;
  if coalesce(p_value, 0) < 0 then perform app.fail('E_INVALID', p_label || ' value cannot be negative.'); end if;
  if p_type = 'percent' and p_value > 100 then perform app.fail('E_INVALID', p_label || ' percent cannot be over 100.'); end if;
end $$;

create or replace function public.save_rate_plan(
  p_property_id uuid, p_id uuid, p_code text, p_name text, p_is_corporate boolean,
  p_cancellation_type text, p_cancellation_value numeric,
  p_no_show_type text, p_no_show_value numeric,
  p_deposit_type text, p_deposit_value numeric, p_is_active boolean)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_tenant uuid;
begin
  perform app.require('setup.rate.manage', p_property_id);
  if coalesce(btrim(p_code), '') = '' or coalesce(btrim(p_name), '') = '' then
    perform app.fail('E_REQUIRED', 'Code and name are required.'); end if;
  perform app.check_policy('Cancellation policy', p_cancellation_type, p_cancellation_value);
  perform app.check_policy('No-show policy', p_no_show_type, p_no_show_value);
  perform app.check_policy('Deposit policy', p_deposit_type, p_deposit_value);
  select tenant_id into v_tenant from public.properties where id = p_property_id;
  begin
    if p_id is null then
      insert into public.rate_plans(tenant_id, property_id, code, name, is_corporate,
        cancellation_policy_type, cancellation_policy_value, no_show_policy_type, no_show_policy_value,
        deposit_policy_type, deposit_policy_value, is_active)
      values (v_tenant, p_property_id, upper(btrim(p_code)), btrim(p_name), coalesce(p_is_corporate, false),
        p_cancellation_type, coalesce(p_cancellation_value, 0), p_no_show_type, coalesce(p_no_show_value, 0),
        p_deposit_type, coalesce(p_deposit_value, 0), coalesce(p_is_active, true))
      returning id into v_id;
    else
      update public.rate_plans set code = upper(btrim(p_code)), name = btrim(p_name),
        is_corporate = coalesce(p_is_corporate, false),
        cancellation_policy_type = p_cancellation_type, cancellation_policy_value = coalesce(p_cancellation_value, 0),
        no_show_policy_type = p_no_show_type, no_show_policy_value = coalesce(p_no_show_value, 0),
        deposit_policy_type = p_deposit_type, deposit_policy_value = coalesce(p_deposit_value, 0),
        is_active = coalesce(p_is_active, true)
      where id = p_id and property_id = p_property_id returning id into v_id;
      if v_id is null then perform app.fail('E_NOT_FOUND', 'Rate plan not found.'); end if;
    end if;
  exception when unique_violation then
    perform app.fail('E_DUPLICATE', 'That rate plan code is already used.');
  end;
  return v_id;
end $$;

create or replace function public.save_rate_plan_price(
  p_id uuid, p_rate_plan_id uuid, p_room_type_id uuid, p_valid_from date, p_valid_to date,
  p_amount numeric, p_currency text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_property uuid; v_tenant uuid; v_cur text;
begin
  select property_id, tenant_id into v_property, v_tenant from public.rate_plans where id = p_rate_plan_id;
  if v_property is null then perform app.fail('E_NOT_FOUND', 'Rate plan not found.'); end if;
  perform app.require('setup.rate.manage', v_property);
  if not exists (select 1 from public.room_types where id = p_room_type_id and property_id = v_property) then
    perform app.fail('E_INVALID', 'Choose a room type for this property.'); end if;
  if p_valid_from is null or p_valid_to is null or p_valid_to < p_valid_from then
    perform app.fail('E_INVALID', 'The end date must be on or after the start date.'); end if;
  if p_amount is null or p_amount < 0 then perform app.fail('E_INVALID', 'Enter a price of zero or more.'); end if;
  v_cur := upper(coalesce(nullif(btrim(p_currency), ''), (select base_currency from public.properties where id = v_property)));
  if v_cur !~ '^[A-Z]{3}$' then perform app.fail('E_INVALID', 'Currency must be a 3-letter code, e.g. NGN.'); end if;
  if exists (select 1 from public.rate_plan_prices x
             where x.rate_plan_id = p_rate_plan_id and x.room_type_id = p_room_type_id
               and x.id is distinct from p_id
               and x.valid_from <= p_valid_to and x.valid_to >= p_valid_from) then
    perform app.fail('E_OVERLAP', 'These dates overlap an existing price for this room type.');
  end if;
  if p_id is null then
    insert into public.rate_plan_prices(tenant_id, property_id, rate_plan_id, room_type_id, valid_from, valid_to, amount, currency)
    values (v_tenant, v_property, p_rate_plan_id, p_room_type_id, p_valid_from, p_valid_to, p_amount, v_cur)
    returning id into v_id;
  else
    update public.rate_plan_prices set room_type_id = p_room_type_id, valid_from = p_valid_from,
      valid_to = p_valid_to, amount = p_amount, currency = v_cur
    where id = p_id and rate_plan_id = p_rate_plan_id returning id into v_id;
    if v_id is null then perform app.fail('E_NOT_FOUND', 'Price not found.'); end if;
  end if;
  return v_id;
end $$;

create or replace function public.delete_rate_plan_price(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_property uuid;
begin
  select property_id into v_property from public.rate_plan_prices where id = p_id;
  if v_property is null then perform app.fail('E_NOT_FOUND', 'Price not found.'); end if;
  perform app.require('setup.rate.manage', v_property);
  delete from public.rate_plan_prices where id = p_id;
end $$;

create or replace function public.save_tax_rate(
  p_property_id uuid, p_id uuid, p_code text, p_name text, p_percent numeric, p_sort_order integer,
  p_compounds_on_previous boolean, p_description text, p_is_active boolean)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_tenant uuid;
begin
  perform app.require('setup.tax.manage', p_property_id);
  if coalesce(btrim(p_code), '') = '' or coalesce(btrim(p_name), '') = '' then
    perform app.fail('E_REQUIRED', 'Code and name are required.'); end if;
  if p_percent is null or p_percent < 0 or p_percent > 100 then
    perform app.fail('E_INVALID', 'Percent must be between 0 and 100.'); end if;
  select tenant_id into v_tenant from public.properties where id = p_property_id;
  begin
    if p_id is null then
      insert into public.tax_rates(tenant_id, property_id, code, name, percent, sort_order, compounds_on_previous, description, is_active)
      values (v_tenant, p_property_id, upper(btrim(p_code)), btrim(p_name), p_percent, coalesce(p_sort_order, 1),
              coalesce(p_compounds_on_previous, false), nullif(btrim(p_description), ''), coalesce(p_is_active, true))
      returning id into v_id;
    else
      update public.tax_rates set code = upper(btrim(p_code)), name = btrim(p_name), percent = p_percent,
        sort_order = coalesce(p_sort_order, 1), compounds_on_previous = coalesce(p_compounds_on_previous, false),
        description = nullif(btrim(p_description), ''), is_active = coalesce(p_is_active, true)
      where id = p_id and property_id = p_property_id returning id into v_id;
      if v_id is null then perform app.fail('E_NOT_FOUND', 'Tax rate not found.'); end if;
    end if;
  exception when unique_violation then
    perform app.fail('E_DUPLICATE', 'That tax code is already used.');
  end;
  return v_id;
end $$;

create or replace function public.save_charge_code(
  p_property_id uuid, p_id uuid, p_code text, p_name text, p_category text, p_is_taxable boolean, p_is_active boolean)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_tenant uuid;
begin
  perform app.require('setup.tax.manage', p_property_id);
  if coalesce(btrim(p_code), '') = '' or coalesce(btrim(p_name), '') = '' then
    perform app.fail('E_REQUIRED', 'Code and name are required.'); end if;
  if p_category not in ('room','food','service','tax','other') then
    perform app.fail('E_INVALID', 'Choose a category.'); end if;
  select tenant_id into v_tenant from public.properties where id = p_property_id;
  begin
    if p_id is null then
      insert into public.charge_codes(tenant_id, property_id, code, name, category, is_taxable, is_active)
      values (v_tenant, p_property_id, upper(btrim(p_code)), btrim(p_name), p_category,
              coalesce(p_is_taxable, true), coalesce(p_is_active, true))
      returning id into v_id;
    else
      update public.charge_codes set code = upper(btrim(p_code)), name = btrim(p_name), category = p_category,
        is_taxable = coalesce(p_is_taxable, true), is_active = coalesce(p_is_active, true)
      where id = p_id and property_id = p_property_id returning id into v_id;
      if v_id is null then perform app.fail('E_NOT_FOUND', 'Charge code not found.'); end if;
    end if;
  exception when unique_violation then
    perform app.fail('E_DUPLICATE', 'That charge code is already used.');
  end;
  return v_id;
end $$;

create or replace function public.save_payment_method(
  p_property_id uuid, p_id uuid, p_code text, p_name text, p_kind text, p_is_active boolean)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_tenant uuid;
begin
  perform app.require('setup.tax.manage', p_property_id);
  if coalesce(btrim(p_code), '') = '' or coalesce(btrim(p_name), '') = '' then
    perform app.fail('E_REQUIRED', 'Code and name are required.'); end if;
  if p_kind not in ('cash','card','transfer','pos','other') then
    perform app.fail('E_INVALID', 'Choose a kind.'); end if;
  select tenant_id into v_tenant from public.properties where id = p_property_id;
  begin
    if p_id is null then
      insert into public.payment_methods(tenant_id, property_id, code, name, kind, is_active)
      values (v_tenant, p_property_id, upper(btrim(p_code)), btrim(p_name), p_kind, coalesce(p_is_active, true))
      returning id into v_id;
    else
      update public.payment_methods set code = upper(btrim(p_code)), name = btrim(p_name), kind = p_kind,
        is_active = coalesce(p_is_active, true)
      where id = p_id and property_id = p_property_id returning id into v_id;
      if v_id is null then perform app.fail('E_NOT_FOUND', 'Payment method not found.'); end if;
    end if;
  exception when unique_violation then
    perform app.fail('E_DUPLICATE', 'That payment method code is already used.');
  end;
  return v_id;
end $$;

create or replace function public.set_exchange_rate(p_property_id uuid, p_currency text, p_rate_date date, p_rate numeric)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_tenant uuid; v_base text; v_cur text := upper(btrim(coalesce(p_currency, '')));
begin
  perform app.require('setup.rate.manage', p_property_id);
  select tenant_id, base_currency into v_tenant, v_base from public.properties where id = p_property_id;
  if v_cur !~ '^[A-Z]{3}$' then perform app.fail('E_INVALID', 'Currency must be a 3-letter code, e.g. USD.'); end if;
  if v_cur = v_base then perform app.fail('E_INVALID', 'You cannot set a rate for the base currency.'); end if;
  if p_rate_date is null then perform app.fail('E_REQUIRED', 'Date is required.'); end if;
  if p_rate is null or p_rate <= 0 then perform app.fail('E_INVALID', 'Rate must be more than zero.'); end if;
  insert into public.exchange_rates(tenant_id, property_id, currency, rate_date, rate)
  values (v_tenant, p_property_id, v_cur, p_rate_date, p_rate)
  on conflict (property_id, currency, rate_date)
  do update set rate = excluded.rate, updated_at = now()
  returning id into v_id;
  return v_id;
end $$;

revoke all on function
  public.calculate_tax(uuid, numeric, boolean),
  public.update_property(uuid, text, text, text, text, text, time, time),
  public.save_room_type(uuid, uuid, text, text, integer, integer, text, boolean),
  public.save_room(uuid, uuid, text, uuid, text, boolean),
  public.bulk_add_rooms(uuid, integer, integer, uuid, text),
  public.save_rate_plan(uuid, uuid, text, text, boolean, text, numeric, text, numeric, text, numeric, boolean),
  public.save_rate_plan_price(uuid, uuid, uuid, date, date, numeric, text),
  public.delete_rate_plan_price(uuid),
  public.save_tax_rate(uuid, uuid, text, text, numeric, integer, boolean, text, boolean),
  public.save_charge_code(uuid, uuid, text, text, text, boolean, boolean),
  public.save_payment_method(uuid, uuid, text, text, text, boolean),
  public.set_exchange_rate(uuid, text, date, numeric)
from public, anon;
grant execute on function
  public.calculate_tax(uuid, numeric, boolean),
  public.update_property(uuid, text, text, text, text, text, time, time),
  public.save_room_type(uuid, uuid, text, text, integer, integer, text, boolean),
  public.save_room(uuid, uuid, text, uuid, text, boolean),
  public.bulk_add_rooms(uuid, integer, integer, uuid, text),
  public.save_rate_plan(uuid, uuid, text, text, boolean, text, numeric, text, numeric, text, numeric, boolean),
  public.save_rate_plan_price(uuid, uuid, uuid, date, date, numeric, text),
  public.delete_rate_plan_price(uuid),
  public.save_tax_rate(uuid, uuid, text, text, numeric, integer, boolean, text, boolean),
  public.save_charge_code(uuid, uuid, text, text, text, boolean, boolean),
  public.save_payment_method(uuid, uuid, text, text, text, boolean),
  public.set_exchange_rate(uuid, text, date, numeric)
to authenticated;

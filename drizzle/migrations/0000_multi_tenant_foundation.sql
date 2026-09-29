-- =====================================================================
-- Multi-tenant foundation: tenants, plans, subscriptions, profiles,
-- properties, permissions, roles, approval limits, audit.
-- =====================================================================

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table public.plans (
  code            text primary key,
  name            text not null,
  max_rooms       integer,          -- null = no limit
  max_properties  integer,
  max_users       integer,
  created_at      timestamptz not null default now()
);

create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  country     text not null,
  status      text not null default 'trial'
              check (status in ('trial','active','past_due','expired','suspended','cancelled')),
  created_at  timestamptz not null default now()
);

create table public.tenant_subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null unique references public.tenants(id) on delete cascade,
  plan_code           text not null references public.plans(code),
  status              text not null default 'trial'
                      check (status in ('trial','active','past_due','expired','suspended','cancelled')),
  trial_ends_at       timestamptz,
  current_period_end  timestamptz,
  created_at          timestamptz not null default now()
);

create table public.profiles (
  id          uuid primary key,  -- same as auth.users.id
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  full_name   text not null,
  phone       text,
  status      text not null default 'active' check (status in ('active','disabled')),
  created_at  timestamptz not null default now()
);
create index profiles_tenant_idx on public.profiles(tenant_id);

create table public.properties (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  name            text not null check (length(btrim(name)) > 0),
  code            text not null,
  address         text,
  city            text,
  country         text,
  base_currency   char(3) not null default 'NGN',
  timezone        text not null default 'Africa/Lagos',
  check_in_time   time not null default '14:00',
  check_out_time  time not null default '12:00',
  business_date   date not null default ((now() at time zone 'Africa/Lagos')::date),
  created_at      timestamptz not null default now(),
  unique (tenant_id, code)
);
create index properties_tenant_idx on public.properties(tenant_id);

create table public.permissions (
  key          text primary key,
  description  text not null,
  module       text not null
);

create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references public.tenants(id) on delete cascade, -- null = system role
  code        text not null,
  name        text not null,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  check ((is_system and tenant_id is null) or (not is_system and tenant_id is not null))
);
create unique index roles_system_code_uq on public.roles(code) where tenant_id is null;
create unique index roles_tenant_code_uq on public.roles(tenant_id, code) where tenant_id is not null;

create table public.role_permissions (
  role_id         uuid not null references public.roles(id) on delete cascade,
  permission_key  text not null references public.permissions(key) on delete cascade,
  grant_level     char(1) not null check (grant_level in ('Y','L','O')),
  tenant_id       uuid references public.tenants(id) on delete cascade, -- copied from role
  primary key (role_id, permission_key)
);
create index role_permissions_tenant_idx on public.role_permissions(tenant_id);

create table public.user_property_roles (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  role_id      uuid not null references public.roles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (user_id, property_id, role_id)
);
create index upr_user_idx on public.user_property_roles(user_id);
create index upr_tenant_idx on public.user_property_roles(tenant_id);

create table public.approval_limits (
  id              uuid primary key default gen_random_uuid(),
  role_id         uuid not null references public.roles(id) on delete cascade,
  permission_key  text not null references public.permissions(key) on delete cascade,
  max_amount      numeric(20,4) not null check (max_amount >= 0),
  tenant_id       uuid references public.tenants(id) on delete cascade, -- copied from role
  unique (role_id, permission_key)
);

create table public.audit_events (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references public.tenants(id) on delete cascade, -- null only for system data
  actor_id    uuid,
  action      text not null,
  table_name  text,
  record_id   text,
  before      jsonb,
  after       jsonb,
  reason      text,
  created_at  timestamptz not null default now()
);
create index audit_events_tenant_idx on public.audit_events(tenant_id, created_at desc);

-- ---------------------------------------------------------------------
-- Grants (no anon access anywhere)
-- ---------------------------------------------------------------------
grant select on public.plans, public.permissions to authenticated;
grant select on public.tenants, public.tenant_subscriptions to authenticated;
grant select, update on public.profiles, public.properties to authenticated;
grant select, insert, update, delete on public.roles, public.role_permissions,
  public.user_property_roles, public.approval_limits to authenticated;
grant select on public.audit_events to authenticated;
grant all on public.plans, public.tenants, public.tenant_subscriptions, public.profiles,
  public.properties, public.permissions, public.roles, public.role_permissions,
  public.user_property_roles, public.approval_limits, public.audit_events to service_role;

-- ---------------------------------------------------------------------
-- Helper functions (schema app, not exposed through the API)
-- ---------------------------------------------------------------------

create or replace function app.fail(p_code text, p_message text)
returns void language plpgsql immutable as $$
begin
  raise exception '[%] %', p_code, p_message using errcode = 'P0001';
end $$;

create or replace function app.my_tenant()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select p.tenant_id from public.profiles p
  where p.id = auth.uid() and p.status = 'active'
$$;

create or replace function app.has_property_access(p_property_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.user_property_roles upr
    join public.properties pr on pr.id = upr.property_id
    where upr.user_id = auth.uid()
      and upr.property_id = p_property_id
      and pr.tenant_id = app.my_tenant()
  )
$$;

-- True if the caller holds the permission (any grant level) on the property.
-- p_property_id null = on any property of the caller's hotel (tenant-level checks).
create or replace function app.can(p_permission_key text, p_property_id uuid default null)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.user_property_roles upr
    join public.role_permissions rp on rp.role_id = upr.role_id
    where upr.user_id = auth.uid()
      and upr.tenant_id = app.my_tenant()
      and rp.permission_key = p_permission_key
      and (p_property_id is null or upr.property_id = p_property_id)
  )
$$;

-- Money limit for a permission. null = unlimited (grant Y).
-- Grant L with no approval_limits row = 0. No grant = 0.
create or replace function app.approval_limit(p_permission_key text, p_property_id uuid)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  with g as (
    select rp.role_id, rp.grant_level
    from public.user_property_roles upr
    join public.role_permissions rp on rp.role_id = upr.role_id
    where upr.user_id = auth.uid()
      and upr.tenant_id = app.my_tenant()
      and upr.property_id = p_property_id
      and rp.permission_key = p_permission_key
  )
  select case
    when exists (select 1 from g where grant_level in ('Y','O')) then null
    else coalesce((
      select max(coalesce(al.max_amount, 0))
      from g left join public.approval_limits al
        on al.role_id = g.role_id and al.permission_key = p_permission_key
      where g.grant_level = 'L'), 0)
  end
$$;

revoke all on all functions in schema app from public;
grant execute on function app.fail(text, text), app.my_tenant(), app.has_property_access(uuid),
  app.can(text, uuid), app.approval_limit(text, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------

create or replace function app.set_tenant_from_role()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  select r.tenant_id into new.tenant_id from public.roles r where r.id = new.role_id;
  return new;
end $$;

create trigger role_permissions_set_tenant before insert or update on public.role_permissions
  for each row execute function app.set_tenant_from_role();
create trigger approval_limits_set_tenant before insert or update on public.approval_limits
  for each row execute function app.set_tenant_from_role();

create or replace function app.check_user_property_role()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prop uuid; v_role uuid; v_role_found boolean; v_user uuid;
begin
  select tenant_id into v_prop from public.properties where id = new.property_id;
  select tenant_id into v_user from public.profiles where id = new.user_id;
  select tenant_id, true into v_role, v_role_found from public.roles where id = new.role_id;
  if v_prop is null or v_user is null or v_role_found is null then
    perform app.fail('E_NOT_FOUND', 'User, property or role not found.');
  end if;
  if v_user <> v_prop or (v_role is not null and v_role <> v_prop) then
    perform app.fail('E_TENANT_MISMATCH', 'User, property and role must belong to the same hotel.');
  end if;
  new.tenant_id := v_prop;
  return new;
end $$;

create trigger upr_check before insert or update on public.user_property_roles
  for each row execute function app.check_user_property_role();

-- Stop the last System Administrator of a hotel being removed.
create or replace function app.guard_last_sysadmin()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_sys uuid;
begin
  select id into v_sys from public.roles where code = 'SYSADMIN' and tenant_id is null;
  if old.role_id <> v_sys then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' and new.role_id = old.role_id and new.user_id = old.user_id then
    return new;
  end if;
  if not exists (
    select 1 from public.user_property_roles u
    join public.profiles p on p.id = u.user_id and p.status = 'active'
    where u.tenant_id = old.tenant_id and u.role_id = v_sys and u.id <> old.id
  ) then
    perform app.fail('E_LAST_SYSADMIN', 'This hotel must keep at least one System Administrator.');
  end if;
  return coalesce(new, old);
end $$;

create trigger upr_guard_last_sysadmin before update or delete on public.user_property_roles
  for each row execute function app.guard_last_sysadmin();

create or replace function app.guard_last_sysadmin_profile()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_sys uuid;
begin
  if tg_op = 'UPDATE' and not (old.status = 'active' and new.status <> 'active') then
    return new;
  end if;
  select id into v_sys from public.roles where code = 'SYSADMIN' and tenant_id is null;
  if exists (select 1 from public.user_property_roles where user_id = old.id and role_id = v_sys)
     and not exists (
       select 1 from public.user_property_roles u
       join public.profiles p on p.id = u.user_id and p.status = 'active'
       where u.tenant_id = old.tenant_id and u.role_id = v_sys and u.user_id <> old.id)
  then
    perform app.fail('E_LAST_SYSADMIN', 'This hotel must keep at least one System Administrator.');
  end if;
  return coalesce(new, old);
end $$;

create trigger profiles_guard_last_sysadmin before update of status or delete on public.profiles
  for each row execute function app.guard_last_sysadmin_profile();

-- Profiles: users may not move themselves to another hotel.
create or replace function app.profiles_lock_tenant()
returns trigger language plpgsql as $$
begin
  if new.tenant_id <> old.tenant_id or new.id <> old.id then
    perform app.fail('E_FORBIDDEN', 'A user cannot be moved to another hotel.');
  end if;
  return new;
end $$;
create trigger profiles_lock_tenant before update on public.profiles
  for each row execute function app.profiles_lock_tenant();

-- ---------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------
create or replace function app.audit_row()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old jsonb; v_new jsonb; v_row jsonb;
begin
  if tg_op in ('UPDATE','DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT','UPDATE') then v_new := to_jsonb(new); end if;
  v_row := coalesce(v_new, v_old);
  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, before, after, reason)
  values (
    (v_row->>'tenant_id')::uuid,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(v_row->>'id', concat_ws(':', v_row->>'role_id', v_row->>'permission_key')),
    v_old, v_new,
    nullif(current_setting('app.audit_reason', true), '')
  );
  return null;
end $$;

create trigger audit_roles after insert or update or delete on public.roles
  for each row execute function app.audit_row();
create trigger audit_role_permissions after insert or update or delete on public.role_permissions
  for each row execute function app.audit_row();
create trigger audit_user_property_roles after insert or update or delete on public.user_property_roles
  for each row execute function app.audit_row();
create trigger audit_approval_limits after insert or update or delete on public.approval_limits
  for each row execute function app.audit_row();

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_property_roles enable row level security;
alter table public.approval_limits enable row level security;
alter table public.audit_events enable row level security;

-- Global reference data
create policy plans_read on public.plans for select to authenticated using (true);
create policy permissions_read on public.permissions for select to authenticated using (true);

-- Tenant
create policy tenants_read on public.tenants for select to authenticated
  using (id = app.my_tenant());
create policy subs_read on public.tenant_subscriptions for select to authenticated
  using (tenant_id = app.my_tenant());

-- Profiles
create policy profiles_read on public.profiles for select to authenticated
  using (tenant_id = app.my_tenant() or id = auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() and tenant_id = app.my_tenant())
  with check (id = auth.uid() and tenant_id = app.my_tenant() and status = 'active');
create policy profiles_update_admin on public.profiles for update to authenticated
  using (tenant_id = app.my_tenant() and app.can('adm.user.manage'))
  with check (tenant_id = app.my_tenant());

-- Properties: only properties the user is assigned to
create policy properties_read on public.properties for select to authenticated
  using (tenant_id = app.my_tenant() and app.has_property_access(id));
create policy properties_update on public.properties for update to authenticated
  using (tenant_id = app.my_tenant() and app.can('setup.property.edit', id))
  with check (tenant_id = app.my_tenant());

-- Roles
create policy roles_read on public.roles for select to authenticated
  using (tenant_id is null or tenant_id = app.my_tenant());
create policy roles_write on public.roles for all to authenticated
  using (tenant_id = app.my_tenant() and not is_system and app.can('adm.role.manage'))
  with check (tenant_id = app.my_tenant() and not is_system and app.can('adm.role.manage'));

create policy role_permissions_read on public.role_permissions for select to authenticated
  using (tenant_id is null or tenant_id = app.my_tenant());
create policy role_permissions_write on public.role_permissions for all to authenticated
  using (tenant_id = app.my_tenant() and app.can('adm.role.manage'))
  with check (tenant_id = app.my_tenant() and app.can('adm.role.manage'));

create policy approval_limits_read on public.approval_limits for select to authenticated
  using (tenant_id is null or tenant_id = app.my_tenant());
create policy approval_limits_write on public.approval_limits for all to authenticated
  using (tenant_id = app.my_tenant() and app.can('adm.role.manage'))
  with check (tenant_id = app.my_tenant() and app.can('adm.role.manage'));

-- User/property/role assignments
create policy upr_read on public.user_property_roles for select to authenticated
  using (tenant_id = app.my_tenant() and (user_id = auth.uid() or app.can('adm.user.manage')));
create policy upr_write on public.user_property_roles for all to authenticated
  using (tenant_id = app.my_tenant() and app.can('adm.user.manage', property_id))
  with check (tenant_id = app.my_tenant() and app.can('adm.user.manage', property_id));

-- Audit: read only, never edited
create policy audit_read on public.audit_events for select to authenticated
  using (tenant_id = app.my_tenant() and app.can('adm.audit.view'));

-- ---------------------------------------------------------------------
-- create_hotel
-- ---------------------------------------------------------------------
create or replace function public.create_hotel(
  p_business_name text, p_country text, p_property_name text, p_full_name text, p_city text)
returns table (tenant_id uuid, property_id uuid)
language plpgsql security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_confirmed timestamptz;
  v_tenant uuid;
  v_property uuid;
  v_code text;
begin
  if v_uid is null then
    perform app.fail('E_NOT_SIGNED_IN', 'Please sign in first.');
  end if;
  select u.email_confirmed_at into v_confirmed from auth.users u where u.id = v_uid;
  if v_confirmed is null then
    perform app.fail('E_EMAIL_NOT_CONFIRMED', 'Please confirm your email address first.');
  end if;
  perform pg_advisory_xact_lock(hashtext('create_hotel:' || v_uid::text));
  if exists (select 1 from public.profiles p where p.id = v_uid) then
    perform app.fail('E_ALREADY_HAS_HOTEL', 'This account already belongs to a hotel.');
  end if;
  if coalesce(btrim(p_business_name), '') = '' then
    perform app.fail('E_REQUIRED', 'Business name is required.'); end if;
  if coalesce(btrim(p_country), '') = '' then
    perform app.fail('E_REQUIRED', 'Country is required.'); end if;
  if coalesce(btrim(p_property_name), '') = '' then
    perform app.fail('E_REQUIRED', 'Property name is required.'); end if;
  if coalesce(btrim(p_full_name), '') = '' then
    perform app.fail('E_REQUIRED', 'Your full name is required.'); end if;

  insert into public.tenants(name, country, status)
  values (btrim(p_business_name), btrim(p_country), 'trial')
  returning id into v_tenant;

  insert into public.tenant_subscriptions(tenant_id, plan_code, status, trial_ends_at, current_period_end)
  values (v_tenant, 'starter', 'trial', now() + interval '30 days', now() + interval '30 days');

  v_code := coalesce(nullif(upper(left(regexp_replace(p_property_name, '[^A-Za-z0-9]', '', 'g'), 8)), ''), 'MAIN');

  insert into public.properties(tenant_id, name, code, city, country)
  values (v_tenant, btrim(p_property_name), v_code, nullif(btrim(p_city), ''), btrim(p_country))
  returning id into v_property;

  insert into public.profiles(id, tenant_id, full_name, status)
  values (v_uid, v_tenant, btrim(p_full_name), 'active');

  insert into public.user_property_roles(user_id, property_id, role_id)
  select v_uid, v_property, r.id from public.roles r
  where r.tenant_id is null and r.code in ('SYSADMIN', 'GM');

  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after)
  values (v_tenant, v_uid, 'create_hotel', 'tenants', v_tenant::text,
          jsonb_build_object('tenant_id', v_tenant, 'property_id', v_property));

  tenant_id := v_tenant;
  property_id := v_property;
  return next;
end $$;

revoke all on function public.create_hotel(text, text, text, text, text) from public, anon;
grant execute on function public.create_hotel(text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Seed data
-- ---------------------------------------------------------------------
insert into public.plans(code, name, max_rooms, max_properties, max_users) values
  ('starter',    'Starter',    20,   1,    10),
  ('standard',   'Standard',   60,   1,    25),
  ('pro',        'Pro',        150,  3,    60),
  ('enterprise', 'Enterprise', null, null, null);

insert into public.permissions(key, description, module) values
  ('setup.property.view',  'View property settings',              'setup'),
  ('setup.property.edit',  'Edit property settings',              'setup'),
  ('setup.room.manage',    'Manage room types and rooms',         'setup'),
  ('setup.rate.manage',    'Manage rate plans',                   'setup'),
  ('setup.tax.manage',     'Manage taxes and service charges',    'setup'),
  ('res.view',             'View reservations',                   'reservations'),
  ('res.create',           'Create reservations',                 'reservations'),
  ('res.edit',             'Edit reservations',                   'reservations'),
  ('res.cancel',           'Cancel reservations',                 'reservations'),
  ('res.noshow',           'Mark reservations as no-show',        'reservations'),
  ('res.group.manage',     'Manage group bookings',               'reservations'),
  ('fo.view',              'View front office board',             'front_office'),
  ('fo.checkin',           'Check guests in',                     'front_office'),
  ('fo.checkout',          'Check guests out',                    'front_office'),
  ('fo.walkin',            'Register walk-in guests',             'front_office'),
  ('fo.room.move',         'Move guests between rooms',           'front_office'),
  ('guest.view',           'View guest profiles',                 'guests'),
  ('guest.create',         'Create guest profiles',               'guests'),
  ('guest.edit',           'Edit guest profiles',                 'guests'),
  ('guest.merge',          'Merge duplicate guest profiles',      'guests'),
  ('room.view',            'View rooms and status',               'rooms'),
  ('room.status.set',      'Set room condition',                  'rooms'),
  ('room.ooo.set',         'Set rooms out of order',              'rooms'),
  ('hk.view',              'View housekeeping tasks',             'housekeeping'),
  ('hk.task.assign',       'Assign housekeeping tasks',           'housekeeping'),
  ('hk.task.complete',     'Complete housekeeping tasks',         'housekeeping'),
  ('hk.inspect',           'Inspect cleaned rooms',               'housekeeping'),
  ('mnt.view',             'View maintenance tickets',            'maintenance'),
  ('mnt.ticket.create',    'Report maintenance issues',           'maintenance'),
  ('mnt.ticket.assign',    'Assign maintenance tickets',          'maintenance'),
  ('mnt.ticket.close',     'Close maintenance tickets',           'maintenance'),
  ('svc.view',             'View service orders',                 'service'),
  ('svc.order.create',     'Create service orders',               'service'),
  ('svc.order.cancel',     'Cancel service orders',               'service'),
  ('fin.folio.view',       'View guest folios',                   'finance'),
  ('fin.charge.post',      'Post charges',                        'finance'),
  ('fin.payment.post',     'Record payments',                     'finance'),
  ('fin.discount.apply',   'Apply discounts',                     'finance'),
  ('fin.discount.approve', 'Approve discounts',                   'finance'),
  ('fin.adjust.post',      'Post adjustments',                    'finance'),
  ('fin.adjust.approve',   'Approve adjustments',                 'finance'),
  ('fin.refund.post',      'Post refunds',                        'finance'),
  ('fin.refund.approve',   'Approve refunds',                     'finance'),
  ('fin.reverse.post',     'Reverse posted transactions',         'finance'),
  ('fin.invoice.issue',    'Issue invoices and receipts',         'finance'),
  ('fin.shift.close',      'Close cashier shift',                 'finance'),
  ('fin.nightaudit.run',   'Run night audit / roll business date','finance'),
  ('rpt.operations.view',  'View operations reports',             'reports'),
  ('rpt.finance.view',     'View finance reports',                'reports'),
  ('adm.user.manage',      'Manage users and their roles',        'admin'),
  ('adm.role.manage',      'Manage roles, permissions and limits','admin'),
  ('adm.audit.view',       'View audit log',                      'admin'),
  ('adm.subscription.manage','Manage subscription and billing',   'admin');

insert into public.roles(tenant_id, code, name, is_system) values
  (null, 'SYSADMIN', 'System Administrator',    true),
  (null, 'GM',       'General Manager',         true),
  (null, 'FOM',      'Front Office Manager',    true),
  (null, 'FDO',      'Front Desk Officer',      true),
  (null, 'RES',      'Reservation Officer',     true),
  (null, 'HKS',      'Housekeeping Supervisor', true),
  (null, 'RA',       'Room Attendant',          true),
  (null, 'MNT',      'Maintenance Officer',     true),
  (null, 'CASHIER',  'Cashier',                 true),
  (null, 'ACCT',     'Accountant',              true);

-- System Administrator and General Manager: everything
insert into public.role_permissions(role_id, permission_key, grant_level)
select r.id, p.key, 'Y' from public.roles r cross join public.permissions p
where r.tenant_id is null and r.code in ('SYSADMIN', 'GM');

insert into public.role_permissions(role_id, permission_key, grant_level)
select r.id, m.key, m.lvl
from (values
  -- Front Office Manager
  ('FOM','setup.property.view','Y'),('FOM','res.view','Y'),('FOM','res.create','Y'),('FOM','res.edit','Y'),
  ('FOM','res.cancel','Y'),('FOM','res.noshow','Y'),('FOM','res.group.manage','Y'),
  ('FOM','fo.view','Y'),('FOM','fo.checkin','Y'),('FOM','fo.checkout','Y'),('FOM','fo.walkin','Y'),('FOM','fo.room.move','Y'),
  ('FOM','guest.view','Y'),('FOM','guest.create','Y'),('FOM','guest.edit','Y'),('FOM','guest.merge','Y'),
  ('FOM','room.view','Y'),('FOM','room.status.set','Y'),('FOM','room.ooo.set','Y'),
  ('FOM','hk.view','Y'),('FOM','mnt.view','Y'),('FOM','mnt.ticket.create','Y'),
  ('FOM','svc.view','Y'),('FOM','svc.order.create','Y'),('FOM','svc.order.cancel','Y'),
  ('FOM','fin.folio.view','Y'),('FOM','fin.charge.post','Y'),('FOM','fin.payment.post','Y'),
  ('FOM','fin.discount.apply','L'),('FOM','fin.discount.approve','L'),('FOM','fin.adjust.post','Y'),
  ('FOM','fin.adjust.approve','L'),('FOM','fin.refund.post','Y'),('FOM','fin.reverse.post','L'),
  ('FOM','fin.invoice.issue','Y'),('FOM','fin.shift.close','Y'),('FOM','fin.nightaudit.run','Y'),
  ('FOM','rpt.operations.view','Y'),('FOM','adm.audit.view','Y'),
  -- Front Desk Officer
  ('FDO','res.view','Y'),('FDO','res.create','Y'),('FDO','res.edit','Y'),
  ('FDO','fo.view','Y'),('FDO','fo.checkin','Y'),('FDO','fo.checkout','Y'),('FDO','fo.walkin','Y'),('FDO','fo.room.move','Y'),
  ('FDO','guest.view','Y'),('FDO','guest.create','Y'),('FDO','guest.edit','Y'),
  ('FDO','room.view','Y'),('FDO','hk.view','Y'),('FDO','mnt.ticket.create','Y'),
  ('FDO','svc.view','Y'),('FDO','svc.order.create','Y'),
  ('FDO','fin.folio.view','Y'),('FDO','fin.charge.post','Y'),('FDO','fin.payment.post','Y'),
  ('FDO','fin.discount.apply','L'),('FDO','fin.adjust.post','L'),('FDO','fin.refund.post','L'),
  ('FDO','fin.invoice.issue','Y'),('FDO','fin.shift.close','O'),
  -- Reservation Officer
  ('RES','res.view','Y'),('RES','res.create','Y'),('RES','res.edit','Y'),('RES','res.cancel','Y'),
  ('RES','res.noshow','Y'),('RES','res.group.manage','Y'),
  ('RES','guest.view','Y'),('RES','guest.create','Y'),('RES','guest.edit','Y'),
  ('RES','room.view','Y'),('RES','fo.view','Y'),
  ('RES','fin.folio.view','Y'),('RES','fin.payment.post','Y'),('RES','fin.discount.apply','L'),
  -- Housekeeping Supervisor
  ('HKS','room.view','Y'),('HKS','room.status.set','Y'),('HKS','room.ooo.set','Y'),
  ('HKS','hk.view','Y'),('HKS','hk.task.assign','Y'),('HKS','hk.task.complete','Y'),('HKS','hk.inspect','Y'),
  ('HKS','mnt.view','Y'),('HKS','mnt.ticket.create','Y'),('HKS','rpt.operations.view','Y'),
  -- Room Attendant
  ('RA','room.view','Y'),('RA','hk.view','O'),('RA','hk.task.complete','O'),('RA','mnt.ticket.create','Y'),
  -- Maintenance Officer
  ('MNT','room.view','Y'),('MNT','room.ooo.set','Y'),('MNT','mnt.view','Y'),
  ('MNT','mnt.ticket.create','Y'),('MNT','mnt.ticket.close','O'),
  -- Cashier
  ('CASHIER','fo.view','Y'),('CASHIER','guest.view','Y'),('CASHIER','svc.view','Y'),('CASHIER','svc.order.create','Y'),
  ('CASHIER','fin.folio.view','Y'),('CASHIER','fin.charge.post','Y'),('CASHIER','fin.payment.post','Y'),
  ('CASHIER','fin.refund.post','L'),('CASHIER','fin.invoice.issue','Y'),('CASHIER','fin.shift.close','O'),
  -- Accountant
  ('ACCT','setup.property.view','Y'),('ACCT','setup.tax.manage','Y'),('ACCT','res.view','Y'),('ACCT','fo.view','Y'),
  ('ACCT','guest.view','Y'),('ACCT','svc.view','Y'),
  ('ACCT','fin.folio.view','Y'),('ACCT','fin.charge.post','Y'),('ACCT','fin.payment.post','Y'),
  ('ACCT','fin.discount.apply','Y'),('ACCT','fin.discount.approve','Y'),('ACCT','fin.adjust.post','Y'),
  ('ACCT','fin.adjust.approve','Y'),('ACCT','fin.refund.post','Y'),('ACCT','fin.refund.approve','Y'),
  ('ACCT','fin.reverse.post','Y'),('ACCT','fin.invoice.issue','Y'),('ACCT','fin.shift.close','Y'),
  ('ACCT','rpt.operations.view','Y'),('ACCT','rpt.finance.view','Y'),('ACCT','adm.audit.view','Y')
) as m(code, key, lvl)
join public.roles r on r.code = m.code and r.tenant_id is null;

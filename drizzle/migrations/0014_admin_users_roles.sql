-- =====================================================================
-- Admin: users, roles, approval limits, audit log, subscription.
-- Nobody can grant a permission they do not hold  -> [E_ESCALATION]
-- The last System Administrator stays              -> [E_LAST_ADMIN]
-- System roles are read only                       -> [E_SYSTEM_ROLE]
-- Plan limits on users are already enforced by app.enforce_plan_limit.
-- =====================================================================

create or replace function app.level_rank(p_level char)
returns integer language sql immutable as $$
  select case p_level when 'Y' then 3 when 'L' then 2 when 'O' then 1 else 0 end
$$;

-- Strongest grant level the caller holds for a permission.
-- p_property null = anywhere in the caller's hotel.
create or replace function app.my_level(p_key text, p_property uuid)
returns char language sql stable security definer set search_path = public, pg_temp as $$
  select (array_agg(rp.grant_level order by app.level_rank(rp.grant_level) desc))[1]
  from public.user_property_roles upr
  join public.role_permissions rp on rp.role_id = upr.role_id
  where upr.user_id = auth.uid()
    and upr.tenant_id = app.my_tenant()
    and rp.permission_key = p_key
    and (p_property is null or upr.property_id = p_property)
$$;

-- Caller's money limit for a permission. null = no limit.
create or replace function app.my_limit(p_key text, p_property uuid)
returns numeric language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v numeric; r record; v_max numeric := 0; v_unlimited boolean := false;
begin
  if p_property is not null then return app.approval_limit(p_key, p_property); end if;
  for r in
    select distinct upr.property_id as pid
    from public.user_property_roles upr
    where upr.user_id = auth.uid() and upr.tenant_id = app.my_tenant()
  loop
    v := app.approval_limit(p_key, r.pid);
    if v is null then v_unlimited := true; else v_max := greatest(v_max, v); end if;
  end loop;
  if v_unlimited then return null; end if;
  return v_max;
end $$;

-- Refuses when the caller would hand out more than they hold themselves.
create or replace function app.assert_can_grant(p_key text, p_level char, p_limit numeric, p_property uuid)
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_mine char; v_my_limit numeric; v_desc text;
begin
  select coalesce(description, p_key) into v_desc from public.permissions where key = p_key;
  v_mine := app.my_level(p_key, p_property);
  if v_mine is null or app.level_rank(v_mine) < app.level_rank(p_level) then
    perform app.fail('E_ESCALATION',
      format('You cannot give "%s" at that level because you do not hold it yourself.', coalesce(v_desc, p_key)));
  end if;
  if p_level = 'L' then
    v_my_limit := app.my_limit(p_key, p_property);
    if v_my_limit is not null and coalesce(p_limit, 0) > v_my_limit then
      perform app.fail('E_ESCALATION',
        format('You cannot set a limit above your own for "%s".', coalesce(v_desc, p_key)));
    end if;
  end if;
end $$;

-- Every permission carried by a role must be grantable by the caller.
create or replace function app.assert_role_grantable(p_role uuid, p_property uuid)
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r record;
begin
  for r in
    select rp.permission_key as k, rp.grant_level as lvl,
           (select al.max_amount from public.approval_limits al
             where al.role_id = p_role and al.permission_key = rp.permission_key) as lim
    from public.role_permissions rp
    where rp.role_id = p_role
  loop
    perform app.assert_can_grant(r.k, r.lvl, r.lim, p_property);
  end loop;
end $$;

-- True when the hotel would be left without an active System Administrator.
create or replace function app.would_drop_last_admin(p_tenant uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.user_property_roles u
    join public.roles r on r.id = u.role_id and r.code = 'SYSADMIN' and r.tenant_id is null
    where u.user_id = p_user and u.tenant_id = p_tenant)
  and not exists (
    select 1 from public.user_property_roles u
    join public.roles r on r.id = u.role_id and r.code = 'SYSADMIN' and r.tenant_id is null
    join public.profiles p on p.id = u.user_id and p.status = 'active'
    where u.tenant_id = p_tenant and u.user_id <> p_user)
$$;

create or replace function app.canany_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select app.can('adm.role.manage', null) or app.can('adm.user.manage', null)
$$;

revoke all on function app.level_rank(char), app.my_level(text, uuid), app.my_limit(text, uuid),
  app.assert_can_grant(text, char, numeric, uuid), app.assert_role_grantable(uuid, uuid),
  app.would_drop_last_admin(uuid, uuid), app.canany_admin() from public;
grant execute on function app.level_rank(char), app.my_level(text, uuid), app.my_limit(text, uuid),
  app.assert_can_grant(text, char, numeric, uuid), app.assert_role_grantable(uuid, uuid),
  app.would_drop_last_admin(uuid, uuid), app.canany_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------

create or replace function public.register_invited_user(
  p_user_id uuid, p_full_name text, p_phone text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid; v_existing uuid;
begin
  perform app.assert_writable();
  v_tenant := app.my_tenant();
  if v_tenant is null or not app.can('adm.user.manage', null) then
    perform app.fail('E_FORBIDDEN', 'You cannot add staff members.');
  end if;
  if p_user_id is null then perform app.fail('E_REQUIRED', 'A user account is required.'); end if;
  if coalesce(btrim(p_full_name), '') = '' then
    perform app.fail('E_REQUIRED', 'Full name is required.');
  end if;

  select tenant_id into v_existing from public.profiles where id = p_user_id;
  if v_existing is not null then
    if v_existing <> v_tenant then
      perform app.fail('E_ALREADY_HAS_HOTEL', 'This email already belongs to another hotel.');
    end if;
    return p_user_id;
  end if;

  insert into public.profiles(id, tenant_id, full_name, phone, status)
  values (p_user_id, v_tenant, btrim(p_full_name), nullif(btrim(p_phone), ''), 'active');

  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after)
  values (v_tenant, auth.uid(), 'insert', 'profiles', p_user_id::text,
          jsonb_build_object('id', p_user_id, 'full_name', btrim(p_full_name), 'status', 'active'));
  return p_user_id;
end $$;

create or replace function public.assign_role(p_user_id uuid, p_property_id uuid, p_role_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid; v_id uuid; v_role public.roles;
begin
  perform app.assert_writable();
  v_tenant := app.my_tenant();
  perform app.require('adm.user.manage', p_property_id);

  select * into v_role from public.roles where id = p_role_id;
  if v_role.id is null or (v_role.tenant_id is not null and v_role.tenant_id <> v_tenant) then
    perform app.fail('E_NOT_FOUND', 'Role not found.');
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and tenant_id = v_tenant) then
    perform app.fail('E_NOT_FOUND', 'Staff member not found.');
  end if;

  perform app.assert_role_grantable(p_role_id, p_property_id);

  insert into public.user_property_roles(tenant_id, user_id, property_id, role_id)
  values (v_tenant, p_user_id, p_property_id, p_role_id)
  on conflict (user_id, property_id, role_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.user_property_roles
    where user_id = p_user_id and property_id = p_property_id and role_id = p_role_id;
  end if;
  return v_id;
end $$;

create or replace function public.remove_role(p_user_id uuid, p_property_id uuid, p_role_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid; v_sys uuid; v_left integer;
begin
  perform app.assert_writable();
  v_tenant := app.my_tenant();
  perform app.require('adm.user.manage', p_property_id);

  select id into v_sys from public.roles where code = 'SYSADMIN' and tenant_id is null;
  if p_role_id = v_sys then
    select count(*) into v_left
    from public.user_property_roles u
    join public.profiles p on p.id = u.user_id and p.status = 'active'
    where u.tenant_id = v_tenant and u.role_id = v_sys
      and not (u.user_id = p_user_id and u.property_id = p_property_id);
    if v_left = 0 then
      perform app.fail('E_LAST_ADMIN', 'This hotel must keep at least one System Administrator.');
    end if;
  end if;

  delete from public.user_property_roles
  where tenant_id = v_tenant and user_id = p_user_id and property_id = p_property_id and role_id = p_role_id;
end $$;

create or replace function public.set_user_status(p_user_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid; v_before public.profiles;
begin
  perform app.assert_writable();
  v_tenant := app.my_tenant();
  if not app.can('adm.user.manage', null) then
    perform app.fail('E_FORBIDDEN', 'You cannot manage staff members.');
  end if;
  if p_status not in ('active', 'disabled') then
    perform app.fail('E_INVALID', 'Status must be active or disabled.');
  end if;
  select * into v_before from public.profiles where id = p_user_id and tenant_id = v_tenant;
  if v_before.id is null then perform app.fail('E_NOT_FOUND', 'Staff member not found.'); end if;
  if v_before.status = p_status then return; end if;

  if p_status = 'disabled' then
    if p_user_id = auth.uid() then
      perform app.fail('E_FORBIDDEN', 'You cannot switch off your own account.');
    end if;
    if app.would_drop_last_admin(v_tenant, p_user_id) then
      perform app.fail('E_LAST_ADMIN', 'This hotel must keep at least one System Administrator.');
    end if;
  end if;

  update public.profiles set status = p_status where id = p_user_id;

  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, before, after)
  values (v_tenant, auth.uid(), 'update', 'profiles', p_user_id::text,
          jsonb_build_object('status', v_before.status), jsonb_build_object('status', p_status));
end $$;

create or replace function public.admin_users()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_tenant uuid;
begin
  v_tenant := app.my_tenant();
  if v_tenant is null or not app.can('adm.user.manage', null) then
    perform app.fail('E_FORBIDDEN', 'You cannot view staff members.');
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'phone', p.phone,
      'status', p.status,
      'email', u.email,
      'email_confirmed', (u.email_confirmed_at is not null),
      'last_sign_in_at', u.last_sign_in_at,
      'created_at', p.created_at,
      'is_me', (p.id = auth.uid()),
      'roles', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', upr.id, 'property_id', pr.id, 'property_name', pr.name,
          'role_id', r.id, 'role_code', r.code, 'role_name', r.name)
          order by pr.name, r.name)
        from public.user_property_roles upr
        join public.properties pr on pr.id = upr.property_id
        join public.roles r on r.id = upr.role_id
        where upr.user_id = p.id and upr.tenant_id = v_tenant), '[]'::jsonb)
    ) order by p.status, p.full_name)
    from public.profiles p
    left join auth.users u on u.id = p.id
    where p.tenant_id = v_tenant), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------

create or replace function public.admin_roles()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_tenant uuid;
begin
  v_tenant := app.my_tenant();
  if v_tenant is null or not app.canany_admin() then
    perform app.fail('E_FORBIDDEN', 'You cannot view roles.');
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'code', r.code, 'name', r.name, 'is_system', r.is_system,
      'user_count', (select count(distinct u.user_id) from public.user_property_roles u
                      where u.role_id = r.id and u.tenant_id = v_tenant),
      'permissions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'key', rp.permission_key, 'level', rp.grant_level,
          'max_amount', (select al.max_amount from public.approval_limits al
                          where al.role_id = r.id and al.permission_key = rp.permission_key))
          order by rp.permission_key)
        from public.role_permissions rp where rp.role_id = r.id), '[]'::jsonb)
    ) order by r.is_system desc, r.name)
    from public.roles r
    where r.tenant_id is null or r.tenant_id = v_tenant), '[]'::jsonb);
end $$;

create or replace function public.copy_role(p_source_role_id uuid, p_code text, p_name text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid; v_src public.roles; v_id uuid;
begin
  perform app.assert_writable();
  v_tenant := app.my_tenant();
  if v_tenant is null or not app.can('adm.role.manage', null) then
    perform app.fail('E_FORBIDDEN', 'You cannot manage roles.');
  end if;
  select * into v_src from public.roles where id = p_source_role_id;
  if v_src.id is null or (v_src.tenant_id is not null and v_src.tenant_id <> v_tenant) then
    perform app.fail('E_NOT_FOUND', 'Role not found.');
  end if;
  if coalesce(btrim(p_code), '') = '' or coalesce(btrim(p_name), '') = '' then
    perform app.fail('E_REQUIRED', 'A short code and a name are required.');
  end if;
  if exists (select 1 from public.roles where tenant_id = v_tenant and upper(code) = upper(btrim(p_code))) then
    perform app.fail('E_DUPLICATE', 'A role with that short code already exists.');
  end if;

  perform app.assert_role_grantable(p_source_role_id, null);

  insert into public.roles(tenant_id, code, name, is_system)
  values (v_tenant, upper(btrim(p_code)), btrim(p_name), false)
  returning id into v_id;

  insert into public.role_permissions(role_id, permission_key, grant_level)
  select v_id, rp.permission_key, rp.grant_level
  from public.role_permissions rp where rp.role_id = p_source_role_id;

  insert into public.approval_limits(role_id, permission_key, max_amount)
  select v_id, al.permission_key, al.max_amount
  from public.approval_limits al where al.role_id = p_source_role_id;

  return v_id;
end $$;

create or replace function public.rename_role(p_role_id uuid, p_name text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid; v_role public.roles;
begin
  perform app.assert_writable();
  v_tenant := app.my_tenant();
  if not app.can('adm.role.manage', null) then perform app.fail('E_FORBIDDEN', 'You cannot manage roles.'); end if;
  select * into v_role from public.roles where id = p_role_id;
  if v_role.id is null or v_role.tenant_id is distinct from v_tenant then
    perform app.fail('E_NOT_FOUND', 'Role not found.'); end if;
  if v_role.is_system then perform app.fail('E_SYSTEM_ROLE', 'Built-in roles cannot be changed. Copy one instead.'); end if;
  if coalesce(btrim(p_name), '') = '' then perform app.fail('E_REQUIRED', 'A name is required.'); end if;
  update public.roles set name = btrim(p_name) where id = p_role_id;
end $$;

-- Replaces the whole permission set of a custom role.
-- p_permissions: [{"key":"res.view","level":"Y","max_amount":null}, ...]
create or replace function public.set_role_permissions(p_role_id uuid, p_permissions jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid; v_role public.roles; r record;
begin
  perform app.assert_writable();
  v_tenant := app.my_tenant();
  if not app.can('adm.role.manage', null) then perform app.fail('E_FORBIDDEN', 'You cannot manage roles.'); end if;
  select * into v_role from public.roles where id = p_role_id;
  if v_role.id is null or v_role.tenant_id is distinct from v_tenant then
    perform app.fail('E_NOT_FOUND', 'Role not found.'); end if;
  if v_role.is_system then perform app.fail('E_SYSTEM_ROLE', 'Built-in roles cannot be changed. Copy one instead.'); end if;
  if p_permissions is null or jsonb_typeof(p_permissions) <> 'array' then
    perform app.fail('E_INVALID', 'A list of permissions is required.');
  end if;

  for r in
    select x->>'key' as k,
           upper(coalesce(x->>'level', 'Y'))::char as lvl,
           nullif(x->>'max_amount', '')::numeric as lim
    from jsonb_array_elements(p_permissions) x
  loop
    if not exists (select 1 from public.permissions where key = r.k) then
      perform app.fail('E_NOT_FOUND', format('Unknown permission "%s".', r.k));
    end if;
    if r.lvl not in ('Y', 'L', 'O') then
      perform app.fail('E_INVALID', 'Grant level must be Y, L or O.');
    end if;
    perform app.assert_can_grant(r.k, r.lvl, r.lim, null);
  end loop;

  delete from public.role_permissions where role_id = p_role_id;
  delete from public.approval_limits where role_id = p_role_id;

  insert into public.role_permissions(role_id, permission_key, grant_level)
  select x->>'key', upper(coalesce(x->>'level', 'Y'))::char
  from jsonb_array_elements(p_permissions) x;

  insert into public.approval_limits(role_id, permission_key, max_amount)
  select x->>'key', (x->>'max_amount')::numeric
  from jsonb_array_elements(p_permissions) x
  where upper(coalesce(x->>'level', 'Y')) = 'L' and nullif(x->>'max_amount', '') is not null;
end $$;

create or replace function public.delete_role(p_role_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid; v_role public.roles;
begin
  perform app.assert_writable();
  v_tenant := app.my_tenant();
  if not app.can('adm.role.manage', null) then perform app.fail('E_FORBIDDEN', 'You cannot manage roles.'); end if;
  select * into v_role from public.roles where id = p_role_id;
  if v_role.id is null or v_role.tenant_id is distinct from v_tenant then
    perform app.fail('E_NOT_FOUND', 'Role not found.'); end if;
  if v_role.is_system then perform app.fail('E_SYSTEM_ROLE', 'Built-in roles cannot be removed.'); end if;
  if exists (select 1 from public.user_property_roles where role_id = p_role_id) then
    perform app.fail('E_IN_USE', 'Staff members still have this role. Remove it from them first.');
  end if;
  delete from public.roles where id = p_role_id;
end $$;

create or replace function public.set_approval_limit(
  p_role_id uuid, p_permission_key text, p_max_amount numeric)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid; v_role public.roles;
begin
  perform app.assert_writable();
  v_tenant := app.my_tenant();
  if not app.can('adm.role.manage', null) then perform app.fail('E_FORBIDDEN', 'You cannot manage limits.'); end if;
  select * into v_role from public.roles where id = p_role_id;
  if v_role.id is null or v_role.tenant_id is distinct from v_tenant then
    perform app.fail('E_NOT_FOUND', 'Role not found.'); end if;
  if v_role.is_system then perform app.fail('E_SYSTEM_ROLE', 'Built-in roles cannot be changed. Copy one instead.'); end if;
  if not exists (select 1 from public.role_permissions where role_id = p_role_id and permission_key = p_permission_key) then
    perform app.fail('E_NOT_FOUND', 'This role does not have that permission.');
  end if;

  if p_max_amount is null then
    delete from public.approval_limits where role_id = p_role_id and permission_key = p_permission_key;
    return;
  end if;
  if p_max_amount < 0 then perform app.fail('E_INVALID', 'The amount cannot be negative.'); end if;

  perform app.assert_can_grant(p_permission_key, 'L', p_max_amount, null);

  insert into public.approval_limits(role_id, permission_key, max_amount)
  values (p_role_id, p_permission_key, p_max_amount)
  on conflict (role_id, permission_key) do update set max_amount = excluded.max_amount;
end $$;

-- ---------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------
create or replace function public.audit_log(
  p_actor uuid default null,
  p_table text default null,
  p_action text default null,
  p_from date default null,
  p_to date default null,
  p_limit integer default 200)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_tenant uuid;
begin
  v_tenant := app.my_tenant();
  if v_tenant is null or not app.can('adm.audit.view', null) then
    perform app.fail('E_FORBIDDEN', 'You cannot view the audit log.');
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(t)::jsonb)
    from (
      select a.id, a.action, a.table_name, a.record_id, a.before, a.after, a.reason, a.created_at,
             a.actor_id, coalesce(p.full_name, 'System') as actor_name
      from public.audit_events a
      left join public.profiles p on p.id = a.actor_id
      where a.tenant_id = v_tenant
        and (p_actor is null or a.actor_id = p_actor)
        and (p_table is null or a.table_name = p_table)
        and (p_action is null or a.action = p_action)
        and (p_from is null or a.created_at >= p_from::timestamptz)
        and (p_to is null or a.created_at < (p_to + 1)::timestamptz)
      order by a.created_at desc
      limit greatest(1, least(coalesce(p_limit, 200), 500))
    ) t), '[]'::jsonb);
end $$;

create or replace function public.audit_filters()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_tenant uuid;
begin
  v_tenant := app.my_tenant();
  if v_tenant is null or not app.can('adm.audit.view', null) then
    perform app.fail('E_FORBIDDEN', 'You cannot view the audit log.');
  end if;
  return jsonb_build_object(
    'tables', coalesce((select jsonb_agg(distinct a.table_name) from public.audit_events a
                         where a.tenant_id = v_tenant and a.table_name is not null), '[]'::jsonb),
    'actions', coalesce((select jsonb_agg(distinct a.action) from public.audit_events a
                          where a.tenant_id = v_tenant), '[]'::jsonb),
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name) order by p.full_name)
                         from public.profiles p where p.tenant_id = v_tenant), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------
-- Subscription
-- ---------------------------------------------------------------------
create or replace function public.subscription_info()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_tenant uuid;
begin
  v_tenant := app.my_tenant();
  if v_tenant is null then perform app.fail('E_FORBIDDEN', 'You do not belong to a hotel.'); end if;
  return (
    select jsonb_build_object(
      'tenant_name', t.name,
      'tenant_status', t.status,
      'country', t.country,
      'writable', app.tenant_writable(v_tenant),
      'plan_code', s.plan_code,
      'plan_name', pl.name,
      'status', s.status,
      'trial_ends_at', s.trial_ends_at,
      'current_period_end', s.current_period_end,
      'trial_days_left', case when s.trial_ends_at is null then null
        else greatest(0, ceil(extract(epoch from (s.trial_ends_at - now())) / 86400))::int end,
      'limits', jsonb_build_object('rooms', pl.max_rooms, 'properties', pl.max_properties, 'users', pl.max_users),
      'usage', jsonb_build_object(
        'rooms', (select count(*) from public.rooms where tenant_id = v_tenant and is_active),
        'properties', (select count(*) from public.properties where tenant_id = v_tenant),
        'users', (select count(*) from public.profiles where tenant_id = v_tenant and status = 'active')),
      'plans', coalesce((select jsonb_agg(jsonb_build_object(
          'code', x.code, 'name', x.name, 'max_rooms', x.max_rooms,
          'max_properties', x.max_properties, 'max_users', x.max_users) order by x.max_rooms nulls last)
        from public.plans x), '[]'::jsonb))
    from public.tenants t
    join public.tenant_subscriptions s on s.tenant_id = t.id
    join public.plans pl on pl.code = s.plan_code
    where t.id = v_tenant);
end $$;

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
revoke all on function
  public.register_invited_user(uuid, text, text),
  public.assign_role(uuid, uuid, uuid),
  public.remove_role(uuid, uuid, uuid),
  public.set_user_status(uuid, text),
  public.admin_users(),
  public.admin_roles(),
  public.copy_role(uuid, text, text),
  public.rename_role(uuid, text),
  public.set_role_permissions(uuid, jsonb),
  public.delete_role(uuid),
  public.set_approval_limit(uuid, text, numeric),
  public.audit_log(uuid, text, text, date, date, integer),
  public.audit_filters(),
  public.subscription_info()
from public, anon;

grant execute on function
  public.register_invited_user(uuid, text, text),
  public.assign_role(uuid, uuid, uuid),
  public.remove_role(uuid, uuid, uuid),
  public.set_user_status(uuid, text),
  public.admin_users(),
  public.admin_roles(),
  public.copy_role(uuid, text, text),
  public.rename_role(uuid, text),
  public.set_role_permissions(uuid, jsonb),
  public.delete_role(uuid),
  public.set_approval_limit(uuid, text, numeric),
  public.audit_log(uuid, text, text, date, date, integer),
  public.audit_filters(),
  public.subscription_info()
to authenticated;

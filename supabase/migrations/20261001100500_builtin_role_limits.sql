-- Built-in roles carry approval limits, set per hotel (decision 6c).
--
-- Before: only a hotel's own (copied) roles could have approval limits. A built-in role with a permission set
-- to L ("limited") had a limit of zero, so every front desk discount waited for a manager until the hotel copied
-- the role and set a limit on the copy.
-- After: the administrator sets a limit directly on a built-in role. The limit belongs to that hotel's account
-- (approval_limits.tenant_id) and never reaches another hotel. Copying a built-in role copies this hotel's limits.
-- The rules for setting one are unchanged: adm.role.manage, the role must hold the permission, the amount is
-- not negative, and nobody can set a limit above their own.

-- A limit row belongs to the role's hotel (own roles) or to the hotel that set it (built-in roles).
create or replace function app.set_limit_tenant()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_role_tenant uuid;
begin
  select r.tenant_id into v_role_tenant from public.roles r where r.id = new.role_id;
  if v_role_tenant is not null then
    new.tenant_id := v_role_tenant;
  elsif new.tenant_id is null then
    new.tenant_id := app.my_tenant();
  end if;
  if new.tenant_id is null then perform app.fail('E_INVALID', 'An approval limit on a built-in role needs a hotel.'); end if;
  return new;
end $$;
revoke all on function app.set_limit_tenant() from public, anon, authenticated;
drop trigger approval_limits_set_tenant on public.approval_limits;
create trigger approval_limits_set_tenant before insert or update on public.approval_limits
  for each row execute function app.set_limit_tenant();

alter table public.approval_limits drop constraint approval_limits_role_id_permission_key_key;
alter table public.approval_limits add constraint approval_limits_tenant_role_permission_key
  unique nulls not distinct (tenant_id, role_id, permission_key);

-- The current user's limit: from their roles, using this hotel's limit rows only.
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
        on al.role_id = g.role_id and al.permission_key = p_permission_key and al.tenant_id = app.my_tenant()
      where g.grant_level = 'L'), 0)
  end
$$;

CREATE OR REPLACE FUNCTION app.assert_role_grantable(p_role uuid, p_property uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r record;
begin
  for r in
    select rp.permission_key as k, rp.grant_level as lvl,
           (select al.max_amount from public.approval_limits al
             where al.role_id = p_role and al.permission_key = rp.permission_key and al.tenant_id = app.my_tenant()) as lim
    from public.role_permissions rp
    where rp.role_id = p_role
  loop
    perform app.assert_can_grant(r.k, r.lvl, r.lim, p_property);
  end loop;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_roles()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
                          where al.role_id = r.id and al.permission_key = rp.permission_key and al.tenant_id = v_tenant))
          order by rp.permission_key)
        from public.role_permissions rp where rp.role_id = r.id), '[]'::jsonb)
    ) order by r.is_system desc, r.name)
    from public.roles r
    where r.tenant_id is null or r.tenant_id = v_tenant), '[]'::jsonb);
end $function$;

CREATE OR REPLACE FUNCTION public.copy_role(p_source_role_id uuid, p_code text, p_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  from public.approval_limits al where al.role_id = p_source_role_id and al.tenant_id = v_tenant;

  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.set_approval_limit(p_role_id uuid, p_permission_key text, p_max_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_tenant uuid; v_role public.roles;
begin
  perform app.assert_writable();
  v_tenant := app.my_tenant();
  if not app.can('adm.role.manage', null) then perform app.fail('E_FORBIDDEN', 'You cannot manage limits.'); end if;
  select * into v_role from public.roles where id = p_role_id;
  if v_role.id is null or (v_role.tenant_id is not null and v_role.tenant_id is distinct from v_tenant) then
    perform app.fail('E_NOT_FOUND', 'Role not found.'); end if;
  if not exists (select 1 from public.role_permissions where role_id = p_role_id and permission_key = p_permission_key) then
    perform app.fail('E_NOT_FOUND', 'This role does not have that permission.');
  end if;

  if p_max_amount is null then
    delete from public.approval_limits where role_id = p_role_id and permission_key = p_permission_key and tenant_id = v_tenant;
    return;
  end if;
  if p_max_amount < 0 then perform app.fail('E_INVALID', 'The amount cannot be negative.'); end if;

  perform app.assert_can_grant(p_permission_key, 'L', p_max_amount, null);

  insert into public.approval_limits(tenant_id, role_id, permission_key, max_amount)
  values (v_tenant, p_role_id, p_permission_key, p_max_amount)
  on conflict (tenant_id, role_id, permission_key) do update set max_amount = excluded.max_amount;
end $function$;

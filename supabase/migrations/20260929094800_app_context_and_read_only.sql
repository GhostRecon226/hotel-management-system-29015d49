-- Tenant writability, read-only enforcement, and one-call user context.

create or replace function app.tenant_writable(p_tenant uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select t.status not in ('expired','suspended') from public.tenants t where t.id = p_tenant), false)
$$;

-- Call at the start of every data-changing function.
-- Pass p_allow_when_read_only = true only for settlement and check-out.
create or replace function app.assert_writable(p_allow_when_read_only boolean default false)
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if p_allow_when_read_only then return; end if;
  if not app.tenant_writable(app.my_tenant()) then
    perform app.fail('E_READ_ONLY',
      'Your subscription is expired or suspended, so the hotel is read-only. Settlement and check-out are still allowed.');
  end if;
end $$;

-- Blocks direct writes by signed-in users when their hotel is read-only.
create or replace function app.enforce_writable()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  v_tenant := coalesce((to_jsonb(coalesce(new, old))->>'tenant_id')::uuid, null);
  if v_tenant is not null and not app.tenant_writable(v_tenant) then
    perform app.fail('E_READ_ONLY',
      'Your subscription is expired or suspended, so the hotel is read-only. Settlement and check-out are still allowed.');
  end if;
  return coalesce(new, old);
end $$;

create trigger profiles_enforce_writable before insert or update or delete on public.profiles
  for each row execute function app.enforce_writable();
create trigger properties_enforce_writable before insert or update or delete on public.properties
  for each row execute function app.enforce_writable();
create trigger roles_enforce_writable before insert or update or delete on public.roles
  for each row execute function app.enforce_writable();
create trigger role_permissions_enforce_writable before insert or update or delete on public.role_permissions
  for each row execute function app.enforce_writable();
create trigger upr_enforce_writable before insert or update or delete on public.user_property_roles
  for each row execute function app.enforce_writable();
create trigger approval_limits_enforce_writable before insert or update or delete on public.approval_limits
  for each row execute function app.enforce_writable();

revoke all on function app.tenant_writable(uuid), app.assert_writable(boolean) from public;
grant execute on function app.tenant_writable(uuid), app.assert_writable(boolean) to authenticated, service_role;

create or replace function public.tenant_is_writable()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select app.tenant_writable(app.my_tenant())
$$;

-- Everything the app shell needs in one call.
create or replace function public.my_context()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_tenant uuid;
  v_result jsonb;
begin
  if v_uid is null then
    perform app.fail('E_NOT_SIGNED_IN', 'Please sign in first.');
  end if;
  v_tenant := app.my_tenant();
  if v_tenant is null then
    return jsonb_build_object(
      'user_id', v_uid,
      'has_hotel', false,
      'disabled', exists (select 1 from public.profiles where id = v_uid and status <> 'active'));
  end if;

  select jsonb_build_object(
    'user_id', v_uid,
    'has_hotel', true,
    'disabled', false,
    'profile', (select jsonb_build_object('full_name', p.full_name, 'phone', p.phone)
                from public.profiles p where p.id = v_uid),
    'tenant', (select jsonb_build_object('id', t.id, 'name', t.name, 'country', t.country, 'status', t.status)
               from public.tenants t where t.id = v_tenant),
    'writable', app.tenant_writable(v_tenant),
    'subscription', (
      select jsonb_build_object(
        'plan_code', s.plan_code, 'plan_name', pl.name, 'status', s.status,
        'trial_ends_at', s.trial_ends_at, 'current_period_end', s.current_period_end,
        'trial_days_left', case when s.trial_ends_at is null then null
          else greatest(0, ceil(extract(epoch from (s.trial_ends_at - now())) / 86400))::int end)
      from public.tenant_subscriptions s join public.plans pl on pl.code = s.plan_code
      where s.tenant_id = v_tenant),
    'properties', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id, 'name', pr.name, 'code', pr.code,
        'business_date', pr.business_date, 'base_currency', pr.base_currency, 'timezone', pr.timezone,
        'permissions', (
          select coalesce(jsonb_object_agg(x.permission_key, x.lvl), '{}'::jsonb)
          from (
            select rp.permission_key,
                   -- strongest grant wins: Y > L > O
                   (array_agg(rp.grant_level order by case rp.grant_level when 'Y' then 1 when 'L' then 2 else 3 end))[1] as lvl
            from public.user_property_roles upr
            join public.role_permissions rp on rp.role_id = upr.role_id
            where upr.user_id = v_uid and upr.property_id = pr.id
            group by rp.permission_key) x)
      ) order by pr.name)
      from public.properties pr
      where pr.tenant_id = v_tenant
        and exists (select 1 from public.user_property_roles u where u.user_id = v_uid and u.property_id = pr.id)
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

revoke all on function public.tenant_is_writable(), public.my_context() from public, anon;
grant execute on function public.tenant_is_writable(), public.my_context() to authenticated;

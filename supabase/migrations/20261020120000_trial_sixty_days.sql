-- [PLT-016] A new hotel gets a 60-day free trial (was 30), with every feature. Peter's decision, 12 Oct 2026.
-- Only the trial length changes in create_hotel. Hotels already on trial keep their dates; platform staff can extend one by hand.
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
  values (v_tenant, 'starter', 'trial', now() + interval '60 days', now() + interval '60 days');

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

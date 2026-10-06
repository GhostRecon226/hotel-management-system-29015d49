-- ADM-002 kept as written (decision of 6 Oct 2026, option a): the System Administrator and General Manager hold
-- every permission, so the General Manager can also add a property (setup.property.create). The plan's property
-- limit still applies. create_property is unchanged except for its refusal message.

insert into public.role_permissions(role_id, permission_key, grant_level)
select r.id, 'setup.property.create', 'Y' from public.roles r
where r.tenant_id is null and r.code = 'GM'
on conflict do nothing;

create or replace function public.create_property(p_name text, p_city text, p_country text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid := app.my_tenant(); v_id uuid; v_code text; v_base text; i int := 1;
begin
  perform app.assert_writable();
  if not app.can('setup.property.create') then
    perform app.fail('E_FORBIDDEN', 'Only the System Administrator or General Manager can add a property.'); end if;
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

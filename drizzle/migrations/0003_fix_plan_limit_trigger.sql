create or replace function app.enforce_plan_limit()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_limit integer; v_count integer; v_plan text; v_what text; v_new jsonb; v_old jsonb;
begin
  v_new := to_jsonb(new);
  if tg_op = 'UPDATE' then v_old := to_jsonb(old); end if;

  if tg_table_name = 'rooms' then
    if not (v_new->>'is_active')::boolean then return new; end if;
    if tg_op = 'UPDATE' and (v_old->>'is_active')::boolean then return new; end if;
  elsif tg_table_name = 'profiles' then
    if v_new->>'status' <> 'active' then return new; end if;
    if tg_op = 'UPDATE' and v_old->>'status' = 'active' then return new; end if;
  end if;

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

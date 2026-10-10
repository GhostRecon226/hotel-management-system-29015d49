-- DAY-008: the roll records open cashier shifts and tells night audit users once. The roll never waits (DAY-005).
CREATE OR REPLACE FUNCTION app.roll_property(p_property uuid, p_trigger text, p_actor uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p public.properties; v_started timestamptz := clock_timestamp(); v_details jsonb; v_err text; v_last text;
  v_charges int; v_expired int; v_noshows int; v_stay int; v_over jsonb; v_open int;
begin
  select * into p from public.properties where id = p_property for update skip locked;
  if p.id is null then return jsonb_build_object('property_id', p_property, 'status', 'busy'); end if;
  begin
    perform set_config('app.settlement', 'on', true);
    perform set_config('app.rolling', 'on', true);
    v_over := app.roll_overstays(p, p.business_date);
    v_charges := app.roll_room_charges(p, p.business_date);
    v_expired := app.roll_expire_holds(p);
    v_noshows := app.roll_no_shows(p, p.business_date);
    select count(*) into v_open from public.cashier_shifts s where s.property_id = p.id and s.status = 'open';
    update public.properties set business_date = p.business_date + 1 where id = p.id;
    v_stay := app.roll_stayovers(p, p.business_date + 1);
    perform app.compute_daily_stats(p.id, p.business_date);
    v_details := jsonb_build_object('overstays', v_over, 'room_charges', v_charges, 'holds_expired', v_expired, 'no_shows', v_noshows, 'stayover_tasks', v_stay, 'open_shifts', v_open);
    insert into public.business_date_log(tenant_id, property_id, from_date, to_date, status, trigger, actor_id, started_at, details)
    values (p.tenant_id, p.id, p.business_date, p.business_date + 1, 'success', p_trigger, p_actor, v_started, v_details);
    if v_open > 0 then
      insert into public.notifications(tenant_id, property_id, user_id, kind, title, body, link)
      select distinct p.tenant_id, p.id, upr.user_id, 'rollover_open_shifts', 'Date rolled with a cashier shift open',
        p.name || ': the date rolled with ' || v_open || case when v_open = 1 then ' cashier shift' else ' cashier shifts' end
          || ' still open. Close and count ' || case when v_open = 1 then 'it' else 'them' end || ' now.', '/admin'
      from public.user_property_roles upr
      join public.role_permissions rp on rp.role_id = upr.role_id and rp.permission_key = 'fin.nightaudit.run'
      join public.profiles pr on pr.id = upr.user_id and pr.status = 'active'
      where upr.property_id = p.id;
    end if;
    perform set_config('app.rolling', '', true);
    perform set_config('app.settlement', '', true);
  exception when others then
    get stacked diagnostics v_err = message_text;
    select status into v_last from public.business_date_log where property_id = p.id order by finished_at desc limit 1;
    insert into public.business_date_log(tenant_id, property_id, from_date, to_date, status, trigger, actor_id, started_at, error)
    values (p.tenant_id, p.id, p.business_date, p.business_date + 1, 'failed', p_trigger, p_actor, v_started, v_err);
    if v_last is distinct from 'failed' then
      insert into public.notifications(tenant_id, property_id, user_id, kind, title, body, link)
      select distinct p.tenant_id, p.id, upr.user_id, 'rollover_failed', 'Business date roll failed',
        p.name || ': ' || regexp_replace(v_err, '^\[[A-Z0-9_]+\]\s*', ''), '/admin'
      from public.user_property_roles upr
      join public.role_permissions rp on rp.role_id = upr.role_id and rp.permission_key = 'fin.nightaudit.run'
      join public.profiles pr on pr.id = upr.user_id and pr.status = 'active'
      where upr.property_id = p.id;
    end if;
    return jsonb_build_object('property_id', p.id, 'status', 'failed', 'error', v_err);
  end;
  return jsonb_build_object('property_id', p.id, 'status', 'success', 'from_date', p.business_date) || v_details;
end $function$;

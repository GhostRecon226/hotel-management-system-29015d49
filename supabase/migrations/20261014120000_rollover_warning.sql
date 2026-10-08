-- DAY-007: a warning before the business date rolls. If a cashier shift is still open in the last hour
-- before the roll time, users who can run the night audit get one notification for that night.
-- The roll itself is unchanged: it never waits for a shift (decision DAY-005).
create or replace function app.warn_before_rollover(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.properties; v_next timestamptz; v_open int; v_total int := 0; v_added int; v_key uuid;
begin
  for p in select * from public.properties order by id loop
    v_next := ((p.business_date + 1)::timestamp + p.rollover_time) at time zone p.timezone;
    continue when p_now >= v_next or p_now < v_next - interval '60 minutes';
    select count(*) into v_open from public.cashier_shifts s where s.property_id = p.id and s.status = 'open';
    continue when v_open = 0;
    v_key := md5(p.id::text || ':' || p.business_date::text)::uuid;  -- one warning per property per business date
    continue when exists (select 1 from public.notifications n
      where n.property_id = p.id and n.kind = 'rollover_warning' and n.entity_id = v_key);
    insert into public.notifications(tenant_id, property_id, user_id, kind, title, body, link, entity_id)
    select distinct p.tenant_id, p.id, upr.user_id, 'rollover_warning', 'Business date rolls soon',
      p.name || ': ' || v_open || case when v_open = 1 then ' cashier shift is' else ' cashier shifts are' end
        || ' still open. The date rolls at ' || to_char(p.rollover_time, 'HH24:MI') || '. Close and count the shifts first.',
      '/cashier', v_key
    from public.user_property_roles upr
    join public.role_permissions rp on rp.role_id = upr.role_id and rp.permission_key = 'fin.nightaudit.run'
    join public.profiles pr on pr.id = upr.user_id and pr.status = 'active'
    where upr.property_id = p.id;
    get diagnostics v_added = row_count;
    v_total := v_total + v_added;
  end loop;
  return v_total;
end $$;
revoke all on function app.warn_before_rollover(timestamptz) from public, anon, authenticated;

select cron.schedule('rollover-warning', '*/5 * * * *', $$select app.warn_before_rollover()$$);

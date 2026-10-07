-- AI helpers, first one: the owner's morning brief (AI-001 to AI-004).
-- Rules this migration enforces in the database:
--   * AI is off for every hotel until a System Administrator or General Manager switches it on.
--   * A monthly limit per hotel. Failed calls do not count.
--   * The only facts that can leave the database for the AI provider are the counts and money lines built here.
--     No guest names, no ID details, no room numbers, no card data.
-- The server asks the provider for a draft; the figures in the draft are checked against these facts by the server.
-- New permissions reach built-in roles only. Custom roles copied earlier do not get adm.ai.manage.

insert into public.permissions(key, description, module)
values ('adm.ai.manage', 'Switch AI helpers on or off and set the monthly limit', 'admin')
on conflict (key) do nothing;

insert into public.role_permissions(role_id, permission_key, grant_level)
select r.id, 'adm.ai.manage', 'Y' from public.roles r
where r.tenant_id is null and r.code in ('SYSADMIN', 'GM')
on conflict do nothing;

create table public.ai_settings (
  tenant_id    uuid primary key references public.tenants(id) on delete cascade,
  enabled      boolean not null default false,
  monthly_cap  integer not null default 30 check (monthly_cap between 0 and 1000),
  updated_by   uuid,
  updated_at   timestamptz not null default now()
);
alter table public.ai_settings enable row level security;
create policy ai_settings_read on public.ai_settings for select to authenticated using (tenant_id = app.my_tenant());

create table public.ai_usage (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  property_id  uuid references public.properties(id) on delete set null,
  user_id      uuid not null,
  feature      text not null,
  status       text not null default 'started' check (status in ('started', 'done', 'failed')),
  created_at   timestamptz not null default now()
);
create index ai_usage_month on public.ai_usage(tenant_id, created_at);
alter table public.ai_usage enable row level security;

revoke all on public.ai_settings, public.ai_usage from public, anon, authenticated;
grant select on public.ai_settings to authenticated;
grant all on public.ai_settings, public.ai_usage to service_role;

create or replace function app.ai_used_this_month(p_tenant uuid)
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int from public.ai_usage
  where tenant_id = p_tenant and status <> 'failed' and created_at >= date_trunc('month', now())
$$;

create or replace function public.ai_status()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_t uuid := app.my_tenant(); s public.ai_settings; v_used int;
begin
  if v_t is null or not (app.can('adm.ai.manage') or app.can('rpt.finance.view')) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to see the AI settings.');
  end if;
  select * into s from public.ai_settings where tenant_id = v_t;
  v_used := app.ai_used_this_month(v_t);
  return jsonb_build_object('enabled', coalesce(s.enabled, false), 'monthly_cap', coalesce(s.monthly_cap, 30), 'used', v_used,
    'remaining', greatest(coalesce(s.monthly_cap, 30) - v_used, 0));
end $$;

create or replace function public.set_ai_settings(p_enabled boolean, p_monthly_cap integer)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_t uuid := app.my_tenant();
begin
  perform app.assert_writable();
  if v_t is null or not app.can('adm.ai.manage') then
    perform app.fail('E_FORBIDDEN', 'Only the System Administrator or General Manager can change the AI settings.');
  end if;
  if p_enabled is null or p_monthly_cap is null or p_monthly_cap < 0 or p_monthly_cap > 1000 then
    perform app.fail('E_INVALID', 'The monthly limit must be between 0 and 1000.');
  end if;
  insert into public.ai_settings(tenant_id, enabled, monthly_cap, updated_by, updated_at)
  values (v_t, p_enabled, p_monthly_cap, auth.uid(), now())
  on conflict (tenant_id) do update set enabled = excluded.enabled, monthly_cap = excluded.monthly_cap,
    updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after)
  values (v_t, auth.uid(), 'set_ai_settings', 'ai_settings', v_t::text, jsonb_build_object('enabled', p_enabled, 'monthly_cap', p_monthly_cap));
end $$;

-- The facts for the brief. Counts and money only. Every line is built here so the wording of every figure comes from the database.
create or replace function app.morning_brief_facts(p public.properties)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare d public.daily_stats; v_arr int; v_dep int; v_in int; v_clean int; v_dirty int; v_ooo int; v_appr int; v_open int; v_urg int;
  v_over numeric; v_over_n int; v_money text; v_lines jsonb; v_yest jsonb; v_occ numeric; v_cur text := p.base_currency::text;
begin
  select * into d from public.daily_stats where property_id = p.id and business_date < p.business_date order by business_date desc limit 1;
  select count(*) into v_arr from public.reservations r where r.property_id = p.id and r.arrival_date = p.business_date and r.status in ('tentative', 'confirmed');
  select count(*) into v_dep from public.reservations r where r.property_id = p.id and r.departure_date = p.business_date and r.status = 'checked_in';
  select count(*) into v_in from public.stays s where s.property_id = p.id and s.status = 'in_house';
  select count(*) into v_clean from public.rooms r where r.property_id = p.id and r.is_active and not r.is_occupied
    and r.condition in ('clean', 'inspected') and not app.room_blocked_today(r.id, p.business_date);
  select count(*) into v_dirty from public.rooms r where r.property_id = p.id and r.is_active and not r.is_occupied
    and r.condition = 'dirty' and not app.room_blocked_today(r.id, p.business_date);
  select count(*) into v_ooo from public.rooms r where r.property_id = p.id and r.is_active
    and (r.condition = 'out_of_order' or app.room_blocked_today(r.id, p.business_date));
  select count(*) into v_appr from public.approvals a where a.property_id = p.id and a.status = 'pending';
  select count(*), count(*) filter (where t.priority = 'urgent') into v_open, v_urg from public.maintenance_tickets t
    where t.property_id = p.id and t.status in ('open', 'assigned', 'in_progress', 'waiting');
  select coalesce(sum(b.balance), 0)::numeric, count(*)::int into v_over, v_over_n from public.v_folio_balances b
    where b.property_id = p.id and b.balance > 0 and b.currency = p.base_currency and b.departure_date < p.business_date - 30;

  if d.property_id is not null then
    v_occ := round(d.rooms_sold * 100.0 / nullif(d.rooms_available, 0), 1);
    v_yest := jsonb_build_object('date', d.business_date, 'occupancy_percent', v_occ, 'rooms_sold', d.rooms_sold,
      'rooms_available', d.rooms_available, 'room_revenue', d.room_revenue, 'total_revenue', d.total_revenue);
  end if;

  v_lines := jsonb_build_array(
    format('Business date: %s at %s.', to_char(p.business_date, 'DD Mon YYYY'), p.name),
    case when d.property_id is null then 'No closed day yet, so there are no figures for last night.'
      else format('Last night: %s%% occupancy (%s of %s rooms), room revenue %s %s, total revenue %s %s.',
        coalesce(v_occ::text, '0'), d.rooms_sold, d.rooms_available,
        v_cur, to_char(d.room_revenue, 'FM999,999,999,990.00'), v_cur, to_char(d.total_revenue, 'FM999,999,999,990.00')) end,
    format('Today: %s arrivals still to come, %s departures still to go, %s guests in house.', v_arr, v_dep, v_in),
    format('Rooms: %s vacant clean, %s vacant dirty, %s out of order.', v_clean, v_dirty, v_ooo),
    format('Waiting: %s approvals, %s open repairs (%s urgent).', v_appr, v_open, v_urg),
    format('Unpaid for more than 30 days after departure: %s %s on %s bills.', v_cur, to_char(v_over, 'FM999,999,999,990.00'), v_over_n));

  return jsonb_build_object('property', p.name, 'business_date', p.business_date, 'currency', v_cur,
    'yesterday', v_yest,
    'today', jsonb_build_object('arrivals_pending', v_arr, 'departures_pending', v_dep, 'in_house', v_in,
      'vacant_clean', v_clean, 'vacant_dirty', v_dirty, 'out_of_order', v_ooo),
    'attention', jsonb_build_object('pending_approvals', v_appr, 'open_tickets', v_open, 'urgent_tickets', v_urg,
      'overdue_over_30_days', v_over, 'overdue_bills', v_over_n),
    'lines', v_lines);
end $$;

-- Start a brief: checks permission, the switch and the monthly limit, logs the call, returns the facts.
create or replace function public.ai_morning_brief_start(p_property_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_t uuid := app.my_tenant(); p public.properties; s public.ai_settings; v_id uuid;
begin
  perform app.assert_writable();
  perform app.require_report('rpt.finance.view', p_property_id);
  perform app.require_report('rpt.operations.view', p_property_id);
  select * into p from public.properties where id = p_property_id and tenant_id = v_t;
  select * into s from public.ai_settings where tenant_id = v_t;
  if not coalesce(s.enabled, false) then
    perform app.fail('E_AI_OFF', 'AI helpers are switched off for this hotel.');
  end if;
  if app.ai_used_this_month(v_t) >= s.monthly_cap then
    perform app.fail('E_AI_LIMIT', 'The monthly AI limit has been reached.');
  end if;
  insert into public.ai_usage(tenant_id, property_id, user_id, feature) values (v_t, p.id, auth.uid(), 'morning_brief') returning id into v_id;
  return jsonb_build_object('usage_id', v_id, 'facts', app.morning_brief_facts(p));
end $$;

-- Close the call. A failed call is not counted against the limit.
create or replace function public.ai_call_finish(p_usage_id uuid, p_ok boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_n int;
begin
  perform app.assert_writable();
  update public.ai_usage set status = case when p_ok then 'done' else 'failed' end
  where id = p_usage_id and tenant_id = app.my_tenant() and user_id = auth.uid() and status = 'started';
  get diagnostics v_n = row_count;
  if v_n = 0 then perform app.fail('E_NOT_FOUND', 'That AI call was not found or has already finished.'); end if;
end $$;

revoke all on function app.ai_used_this_month(uuid), app.morning_brief_facts(public.properties) from public, anon, authenticated;
revoke all on function public.ai_status(), public.set_ai_settings(boolean, integer), public.ai_morning_brief_start(uuid),
  public.ai_call_finish(uuid, boolean) from public, anon;
grant execute on function public.ai_status(), public.set_ai_settings(boolean, integer), public.ai_morning_brief_start(uuid),
  public.ai_call_finish(uuid, boolean) to authenticated;

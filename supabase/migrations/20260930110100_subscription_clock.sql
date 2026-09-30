-- Subscription clock, manual activation and self-cancel (audit finding M4, decisions A13, D7, 5e).
--
-- Two status fields exist. tenants.status decides access (read-only or not). tenant_subscriptions.status
-- is what the hotel sees on its banner. They are now changed together, only by app.change_subscription,
-- and every change writes a subscription_history row.
--
-- Daily clock (app.run_subscription_clock, pg_cron 00:15 UTC):
--   trial whose trial_ends_at has passed               -> expired   (read-only)
--   active whose current_period_end has passed         -> past_due  (still works: 14-day grace, D7)
--   past_due more than 14 days after the period end    -> suspended (read-only)
--   cancelled whose paid period has ended              -> cancelled (read-only)
-- Activation, suspension and plan changes are manual for the first pilots (decision 5e), through
-- app.platform_set_subscription, which only the database owner or service role can call.

create table public.subscription_history (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  from_status  text,
  to_status    text not null,
  plan_code    text,
  period_end   timestamptz,
  reason       text not null,
  source       text not null check (source in ('clock', 'platform', 'hotel')),
  actor_id     uuid,
  created_at   timestamptz not null default now()
);
create index subscription_history_tenant_idx on public.subscription_history(tenant_id, created_at desc);
alter table public.subscription_history enable row level security;
create policy subscription_history_read on public.subscription_history for select to authenticated
  using (tenant_id = app.my_tenant() and app.can('adm.subscription.manage', null));
grant select on public.subscription_history to authenticated;

-- A cancelled hotel is read-only too (the clock only sets tenants.status to cancelled once the paid period ends).
create or replace function app.tenant_writable(p_tenant uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select t.status not in ('expired', 'suspended', 'cancelled') from public.tenants t where t.id = p_tenant), false)
$$;

-- The one place subscription status changes.
create or replace function app.change_subscription(p_tenant uuid, p_status text, p_access text, p_reason text,
  p_source text, p_period_end timestamptz default null, p_plan text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.tenant_subscriptions;
begin
  select * into s from public.tenant_subscriptions where tenant_id = p_tenant for update;
  if s.id is null then perform app.fail('E_NOT_FOUND', 'Subscription not found.'); end if;
  update public.tenant_subscriptions
     set status = p_status,
         current_period_end = coalesce(p_period_end, current_period_end),
         plan_code = coalesce(p_plan, plan_code)
   where tenant_id = p_tenant;
  update public.tenants set status = p_access where id = p_tenant;
  insert into public.subscription_history(tenant_id, from_status, to_status, plan_code, period_end, reason, source, actor_id)
  values (p_tenant, s.status, p_status, coalesce(p_plan, s.plan_code), coalesce(p_period_end, s.current_period_end),
          p_reason, p_source, auth.uid());
end $$;

create or replace function app.run_subscription_clock()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; n integer := 0;
begin
  for r in
    select s.tenant_id, s.status, s.trial_ends_at, s.current_period_end, t.status as access
    from public.tenant_subscriptions s join public.tenants t on t.id = s.tenant_id
    for update of s
  loop
    if r.status = 'trial' and r.trial_ends_at is not null and r.trial_ends_at <= now() then
      perform app.change_subscription(r.tenant_id, 'expired', 'expired', 'Free trial ended', 'clock');
      n := n + 1;
    elsif r.status = 'active' and r.current_period_end is not null and r.current_period_end <= now() then
      perform app.change_subscription(r.tenant_id, 'past_due', 'past_due', 'Paid period ended without payment', 'clock');
      n := n + 1;
    elsif r.status = 'past_due' and r.current_period_end is not null and r.current_period_end + interval '14 days' <= now() then
      perform app.change_subscription(r.tenant_id, 'suspended', 'suspended', 'Unpaid for more than 14 days', 'clock');
      n := n + 1;
    elsif r.status = 'cancelled' and r.access <> 'cancelled'
          and (r.current_period_end is null or r.current_period_end <= now()) then
      perform app.change_subscription(r.tenant_id, 'cancelled', 'cancelled', 'Cancelled subscription reached the end of its paid period', 'clock');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- Manual activation, suspension, closure and plan changes by platform staff (owner or service role only).
create or replace function app.platform_set_subscription(p_tenant uuid, p_status text, p_paid_until timestamptz,
  p_reason text, p_plan text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_plan public.plans; v_rooms int; v_props int; v_users int;
begin
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  if p_status not in ('trial', 'active', 'past_due', 'expired', 'suspended', 'cancelled') then
    perform app.fail('E_INVALID', 'Unknown subscription status.'); end if;
  if p_status = 'active' and (p_paid_until is null or p_paid_until <= now()) then
    perform app.fail('E_INVALID', 'The paid period must end in the future.'); end if;
  if p_plan is not null then
    select * into v_plan from public.plans where code = p_plan;
    if v_plan.code is null then perform app.fail('E_NOT_FOUND', 'Plan not found.'); end if;
    select count(*) into v_rooms from public.rooms where tenant_id = p_tenant and is_active;
    select count(*) into v_props from public.properties where tenant_id = p_tenant;
    select count(*) into v_users from public.profiles where tenant_id = p_tenant and status = 'active';
    if (v_plan.max_rooms is not null and v_rooms > v_plan.max_rooms)
       or (v_plan.max_properties is not null and v_props > v_plan.max_properties)
       or (v_plan.max_users is not null and v_users > v_plan.max_users) then
      perform app.fail('E_PLAN_LIMIT', format('This hotel uses %s rooms, %s properties and %s users, more than the %s plan allows.',
        v_rooms, v_props, v_users, v_plan.name));
    end if;
  end if;
  perform app.change_subscription(p_tenant, p_status, p_status, btrim(p_reason), 'platform', p_paid_until, p_plan);
end $$;

-- A hotel administrator cancels the hotel's own subscription. It keeps working until the paid period ends.
create or replace function public.cancel_subscription(p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid := app.my_tenant(); s public.tenant_subscriptions;
begin
  if v_tenant is null or not app.can('adm.subscription.manage', null) then
    perform app.fail('E_FORBIDDEN', 'You cannot change the subscription.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  select * into s from public.tenant_subscriptions where tenant_id = v_tenant;
  if s.status = 'cancelled' then perform app.fail('E_INVALID', 'The subscription is already cancelled.'); end if;
  perform app.change_subscription(v_tenant, 'cancelled',
    case when s.current_period_end is not null and s.current_period_end > now()
         then (select status from public.tenants where id = v_tenant) else 'cancelled' end,
    btrim(p_reason), 'hotel');
end $$;

revoke all on function app.change_subscription(uuid, text, text, text, text, timestamptz, text),
  app.run_subscription_clock(), app.platform_set_subscription(uuid, text, timestamptz, text, text) from public, anon, authenticated;
grant execute on function app.run_subscription_clock(), app.platform_set_subscription(uuid, text, timestamptz, text, text) to service_role;
revoke all on function public.cancel_subscription(text) from public, anon;
grant execute on function public.cancel_subscription(text) to authenticated;

-- Once a day, shortly after midnight UTC.
select cron.schedule('subscription-clock', '15 0 * * *', 'select app.run_subscription_clock()');

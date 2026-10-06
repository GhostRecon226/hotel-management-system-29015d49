-- Platform console (wave 2, item 2; gate 14; decisions of 6 Oct 2026). PLT-008, PLT-009, PLT-013.
--
-- Before: only the database owner could activate, extend or suspend a hotel, by running
-- app.platform_set_subscription by hand. There was no platform staff role (PLT-009 was not built).
-- After:
--   * app.platform_operators lists the platform operators: separate sign-ins that belong to no hotel. It lives in
--     schema app (not reachable from the browser) and has no grants. Operators are added only by the database owner
--     (Supabase SQL editor) with app.add_platform_operator(email). An operator account can never join or create a
--     hotel (trigger on profiles), and a hotel account can never become an operator.
--   * Every platform function calls app.require_platform(): the caller must be on the operator list AND the session
--     must have passed two-step sign-in (JWT claim aal = aal2, Supabase MFA with an authenticator app). A
--     password-only session gets [E_MFA_REQUIRED]; anyone else gets [E_FORBIDDEN]. The screen checks too, but the
--     database is the rule.
--   * platform_list_tenants: hotel account data only (name, country, status, plan, dates, counts). No guests,
--     bookings, money or contact details. Operators have no hotel, so row-level security shows them no hotel rows.
--   * platform_change_subscription: extend_trial, activate (also reactivates), suspend, change_plan, cancel. Each
--     needs a reason, refuses a change that changes nothing, and writes the existing subscription_history row with
--     the operator as actor (through app.change_subscription / app.platform_set_subscription). Nothing is deleted.
--   * platform_tenant_history: that history, with the operator's sign-in email for platform changes.
-- Hotels are not told by email yet (decision 4); the banner shows the new status.

create table app.platform_operators (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  added_at  timestamptz not null default now(),
  added_by  text not null default current_user
);
alter table app.platform_operators enable row level security;
revoke all on app.platform_operators from public, anon, authenticated;

create or replace function app.add_platform_operator(p_email text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(btrim(p_email));
  if v_id is null then perform app.fail('E_NOT_FOUND', 'No sign-in account has that email. Create it first (Authentication, Users, Add user).'); end if;
  if exists (select 1 from public.profiles where id = v_id) then
    perform app.fail('E_INVALID', 'That account belongs to a hotel. Use a separate account for the platform.'); end if;
  insert into app.platform_operators(user_id) values (v_id) on conflict (user_id) do nothing;
  return v_id;
end $$;
revoke all on function app.add_platform_operator(text) from public, anon, authenticated;

create or replace function app.is_platform_operator()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from app.platform_operators where user_id = auth.uid())
$$;

create or replace function app.require_platform()
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not app.is_platform_operator() then
    perform app.fail('E_FORBIDDEN', 'Only platform operators can do this.'); end if;
  if coalesce(auth.jwt()->>'aal', '') <> 'aal2' then
    perform app.fail('E_MFA_REQUIRED', 'Confirm your sign-in with your authenticator app to use the platform console.'); end if;
end $$;
revoke all on function app.is_platform_operator(), app.require_platform() from public, anon;
grant execute on function app.is_platform_operator(), app.require_platform() to authenticated;

-- An operator account never belongs to a hotel (sign-up and staff invites both create a profile).
create or replace function app.profiles_not_operator()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from app.platform_operators where user_id = new.id) then
    perform app.fail('E_FORBIDDEN', 'This account is a platform operator and cannot belong to a hotel.'); end if;
  return new;
end $$;
create trigger profiles_not_operator before insert on public.profiles
  for each row execute function app.profiles_not_operator();

-- For the screen: is this sign-in an operator, and has it passed two-step sign-in? Only about the caller.
create or replace function public.platform_whoami()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('operator', app.is_platform_operator(), 'mfa', coalesce(auth.jwt()->>'aal', '') = 'aal2')
$$;

create or replace function public.platform_list_tenants()
returns table (tenant_id uuid, hotel_name text, country text, access_status text, subscription_status text,
  plan_code text, plan_name text, trial_ends_at timestamptz, paid_until timestamptz, created_at timestamptz,
  properties integer, rooms integer, active_users integer, last_change_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform app.require_platform();
  return query
  select t.id, t.name, t.country, t.status, s.status, s.plan_code, p.name, s.trial_ends_at, s.current_period_end, t.created_at,
    (select count(*)::int from public.properties x where x.tenant_id = t.id),
    (select count(*)::int from public.rooms x where x.tenant_id = t.id and x.is_active),
    (select count(*)::int from public.profiles x where x.tenant_id = t.id and x.status = 'active'),
    (select max(h.created_at) from public.subscription_history h where h.tenant_id = t.id)
  from public.tenants t
  join public.tenant_subscriptions s on s.tenant_id = t.id
  join public.plans p on p.code = s.plan_code
  order by t.name;
end $$;

create or replace function public.platform_tenant_history(p_tenant uuid)
returns table (created_at timestamptz, from_status text, to_status text, plan_code text, period_end timestamptz,
  reason text, source text, operator_email text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform app.require_platform();
  return query
  select h.created_at, h.from_status, h.to_status, h.plan_code, h.period_end, h.reason, h.source,
    case when h.source = 'platform' then (select u.email::text from auth.users u where u.id = h.actor_id) end
  from public.subscription_history h
  where h.tenant_id = p_tenant
  order by h.created_at desc, h.id desc;
end $$;

create or replace function public.platform_change_subscription(p_tenant uuid, p_action text, p_reason text,
  p_until timestamptz default null, p_plan text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.tenant_subscriptions; v_reason text := btrim(coalesce(p_reason, ''));
begin
  perform app.require_platform();
  if v_reason = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  select * into s from public.tenant_subscriptions where tenant_id = p_tenant for update;
  if s.id is null then perform app.fail('E_NOT_FOUND', 'Hotel not found.'); end if;
  if p_plan is not null and not exists (select 1 from public.plans where code = p_plan) then
    perform app.fail('E_NOT_FOUND', 'Plan not found.'); end if;

  case p_action
    when 'extend_trial' then
      if s.status not in ('trial', 'expired') then
        perform app.fail('E_INVALID', 'Only a hotel on a trial, or whose trial has ended, can get a longer trial.'); end if;
      if p_until is null or p_until <= now() then perform app.fail('E_INVALID', 'The new trial end must be in the future.'); end if;
      if p_until > now() + interval '365 days' then perform app.fail('E_INVALID', 'Extend a trial by at most a year at a time.'); end if;
      if s.status = 'trial' and s.trial_ends_at = p_until then perform app.fail('E_INVALID', 'Nothing to change.'); end if;
      update public.tenant_subscriptions set trial_ends_at = p_until where tenant_id = p_tenant;
      perform app.change_subscription(p_tenant, 'trial', 'trial', v_reason, 'platform');
    when 'activate' then
      if s.status = 'active' and s.current_period_end = p_until and (p_plan is null or p_plan = s.plan_code) then
        perform app.fail('E_INVALID', 'Nothing to change.'); end if;
      perform app.platform_set_subscription(p_tenant, 'active', p_until, v_reason, p_plan);
    when 'suspend' then
      if s.status = 'suspended' then perform app.fail('E_INVALID', 'Nothing to change: the hotel is already suspended.'); end if;
      perform app.platform_set_subscription(p_tenant, 'suspended', null, v_reason, null);
    when 'change_plan' then
      if p_plan is null or p_plan = s.plan_code then perform app.fail('E_INVALID', 'Choose a different plan.'); end if;
      perform app.platform_set_subscription(p_tenant, s.status, s.current_period_end, v_reason, p_plan);
    when 'cancel' then
      if s.status = 'cancelled' then perform app.fail('E_INVALID', 'Nothing to change: the hotel is already cancelled.'); end if;
      perform app.platform_set_subscription(p_tenant, 'cancelled', null, v_reason, null);
    else
      perform app.fail('E_INVALID', 'Unknown action.');
  end case;
end $$;

revoke all on function public.platform_whoami(), public.platform_list_tenants(), public.platform_tenant_history(uuid),
  public.platform_change_subscription(uuid, text, text, timestamptz, text) from public, anon;
grant execute on function public.platform_whoami(), public.platform_list_tenants(), public.platform_tenant_history(uuid),
  public.platform_change_subscription(uuid, text, text, timestamptz, text) to authenticated;

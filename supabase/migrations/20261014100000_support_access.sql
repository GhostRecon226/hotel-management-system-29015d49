-- Support access with the hotel's consent (PLT-010).
-- A platform operator asks for access to one hotel, with a reason and a number of hours. The hotel's
-- administrator says yes or no, and can stop it at any time. Only while a yes is open can the operator open a
-- read-only support view: hotel account data, setup, business date runs and message counts. Never guests,
-- bookings, money, contact details or ID photos. Every step is in the hotel's audit log; the hotel is told.
-- The grant belongs to the operator who asked, for that hotel only, and ends by itself when the time is up.
-- Decisions are allowed on a read-only (expired) hotel: those are the hotels that most need help.

create table public.support_access_grants (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  requested_by       uuid not null,
  requested_by_email text not null,
  reason             text not null check (length(btrim(reason)) > 0),
  hours_requested    integer not null check (hours_requested between 1 and 72),
  status             text not null default 'requested' check (status in ('requested', 'granted', 'denied', 'revoked')),
  requested_at       timestamptz not null default now(),
  decided_by         uuid,
  decided_at         timestamptz,
  expires_at         timestamptz,
  views              integer not null default 0
);
create index support_access_grants_tenant_idx on public.support_access_grants (tenant_id, requested_at desc);
-- One open request or grant per operator and hotel.
create unique index support_access_grants_one_open on public.support_access_grants (tenant_id, requested_by)
  where status in ('requested', 'granted');
alter table public.support_access_grants enable row level security;
revoke all on public.support_access_grants from public, anon, authenticated;

-- New permission, built-in roles only. Custom roles copied earlier do not get it.
insert into public.permissions(key, description, module) values ('adm.support.manage', 'Allow or stop platform support access to this hotel', 'admin')
on conflict (key) do nothing;
insert into public.role_permissions(role_id, permission_key, grant_level)
select r.id, 'adm.support.manage', 'Y' from public.roles r where r.tenant_id is null and r.code in ('SYSADMIN', 'GM')
on conflict do nothing;

-- Whether a grant is open right now.
create or replace function app.support_grant_open(g public.support_access_grants)
returns boolean language sql stable as $$
  select g.status = 'granted' and g.expires_at is not null and g.expires_at > now() $$;

create or replace function app.support_status(g public.support_access_grants)
returns text language sql stable as $$
  select case when g.status = 'granted' and (g.expires_at is null or g.expires_at <= now()) then 'expired' else g.status end $$;

create or replace function app.require_support_manager()
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not app.can('adm.support.manage', null) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to do this.'); end if;
end $$;

-- Operator: ask for access.
create or replace function public.platform_request_support_access(p_tenant uuid, p_reason text, p_hours integer default 24)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_reason text := btrim(coalesce(p_reason, '')); v_id uuid; v_email text; v_name text;
begin
  perform app.require_platform();
  if v_reason = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  if p_hours is null or p_hours < 1 or p_hours > 72 then perform app.fail('E_INVALID', 'Ask for between 1 and 72 hours.'); end if;
  select name into v_name from public.tenants where id = p_tenant;
  if v_name is null then perform app.fail('E_NOT_FOUND', 'Hotel not found.'); end if;
  if exists (select 1 from public.support_access_grants g where g.tenant_id = p_tenant and g.requested_by = auth.uid()
             and (g.status = 'requested' or app.support_grant_open(g))) then
    perform app.fail('E_INVALID', 'You already have an open request or access for this hotel.'); end if;
  -- A grant that ran out stays as history; close it so a new request can follow.
  update public.support_access_grants set status = 'revoked' where tenant_id = p_tenant and requested_by = auth.uid()
    and status = 'granted' and (expires_at is null or expires_at <= now());
  select email::text into v_email from auth.users where id = auth.uid();
  insert into public.support_access_grants(tenant_id, requested_by, requested_by_email, reason, hours_requested)
  values (p_tenant, auth.uid(), coalesce(v_email, ''), v_reason, p_hours) returning id into v_id;
  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after, reason)
  values (p_tenant, auth.uid(), 'support_access_requested', 'support_access_grants', v_id::text,
    jsonb_build_object('hours', p_hours, 'operator', v_email), v_reason);
  insert into public.notifications(tenant_id, user_id, kind, title, body, link, entity_id)
  select distinct p_tenant, upr.user_id, 'support_access_requested', 'Support access requested',
    'Platform support asked to look at your hotel setup for up to ' || p_hours || ' hours. Reason: ' || v_reason, '/admin', v_id
  from public.user_property_roles upr
  join public.role_permissions rp on rp.role_id = upr.role_id and rp.permission_key = 'adm.support.manage'
  where upr.tenant_id = p_tenant;
  return v_id;
end $$;

-- Operator: the state of requests for one hotel (their own).
create or replace function public.platform_support_requests(p_tenant uuid)
returns table (id uuid, status text, reason text, hours_requested integer, requested_at timestamptz,
  decided_at timestamptz, expires_at timestamptz, views integer)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform app.require_platform();
  return query
  select g.id, app.support_status(g), g.reason, g.hours_requested, g.requested_at, g.decided_at, g.expires_at, g.views
  from public.support_access_grants g where g.tenant_id = p_tenant and g.requested_by = auth.uid()
  order by g.requested_at desc limit 20;
end $$;

-- Hotel: see requests.
create or replace function public.list_support_access()
returns table (id uuid, requested_by_email text, reason text, hours_requested integer, status text,
  requested_at timestamptz, decided_at timestamptz, expires_at timestamptz, views integer)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform app.require_support_manager();
  return query
  select g.id, g.requested_by_email, g.reason, g.hours_requested, app.support_status(g), g.requested_at, g.decided_at, g.expires_at, g.views
  from public.support_access_grants g where g.tenant_id = app.my_tenant()
  order by g.requested_at desc limit 50;
end $$;

-- Hotel: say yes (for a number of hours) or no.
create or replace function public.decide_support_access(p_id uuid, p_approve boolean, p_hours integer default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare g public.support_access_grants; v_hours integer;
begin
  perform app.require_support_manager();
  select * into g from public.support_access_grants where id = p_id and tenant_id = app.my_tenant() for update;
  if g.id is null then perform app.fail('E_NOT_FOUND', 'Request not found.'); end if;
  if g.status <> 'requested' then perform app.fail('E_INVALID', 'This request has already been decided.'); end if;
  if p_approve then
    v_hours := coalesce(p_hours, g.hours_requested);
    if v_hours < 1 or v_hours > 72 then perform app.fail('E_INVALID', 'Choose between 1 and 72 hours.'); end if;
    update public.support_access_grants set status = 'granted', decided_by = auth.uid(), decided_at = now(),
      expires_at = now() + make_interval(hours => v_hours) where id = g.id;
    insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after, reason)
    values (g.tenant_id, auth.uid(), 'support_access_granted', 'support_access_grants', g.id::text,
      jsonb_build_object('hours', v_hours, 'operator', g.requested_by_email), g.reason);
  else
    update public.support_access_grants set status = 'denied', decided_by = auth.uid(), decided_at = now() where id = g.id;
    insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after, reason)
    values (g.tenant_id, auth.uid(), 'support_access_denied', 'support_access_grants', g.id::text,
      jsonb_build_object('operator', g.requested_by_email), g.reason);
  end if;
end $$;

-- Hotel: stop open access now.
create or replace function public.revoke_support_access(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare g public.support_access_grants;
begin
  perform app.require_support_manager();
  select * into g from public.support_access_grants where id = p_id and tenant_id = app.my_tenant() for update;
  if g.id is null then perform app.fail('E_NOT_FOUND', 'Request not found.'); end if;
  if not app.support_grant_open(g) then perform app.fail('E_INVALID', 'This access is not open.'); end if;
  update public.support_access_grants set status = 'revoked', expires_at = now() where id = g.id;
  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after)
  values (g.tenant_id, auth.uid(), 'support_access_revoked', 'support_access_grants', g.id::text,
    jsonb_build_object('operator', g.requested_by_email));
end $$;

-- Operator: the read-only support view. Needs an open grant for this operator and this hotel.
create or replace function public.platform_support_snapshot(p_tenant uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare g public.support_access_grants; j jsonb;
begin
  perform app.require_platform();
  select * into g from public.support_access_grants x
   where x.tenant_id = p_tenant and x.requested_by = auth.uid() and x.status = 'granted' and x.expires_at > now()
   for update;
  if g.id is null then perform app.fail('E_NO_CONSENT', 'The hotel has not allowed support access, or it has ended.'); end if;
  update public.support_access_grants set views = views + 1 where id = g.id;
  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after)
  values (p_tenant, auth.uid(), 'support_access_viewed', 'support_access_grants', g.id::text, jsonb_build_object('operator', g.requested_by_email));
  select jsonb_build_object(
    'hotel', (select jsonb_build_object('name', t.name, 'country', t.country, 'access_status', t.status,
        'subscription_status', s.status, 'plan_code', s.plan_code, 'trial_ends_at', s.trial_ends_at, 'paid_until', s.current_period_end)
      from public.tenants t left join public.tenant_subscriptions s on s.tenant_id = t.id where t.id = p_tenant),
    'properties', coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'timezone', p.timezone, 'business_date', p.business_date,
        'rooms', (select count(*) from public.rooms r where r.property_id = p.id and r.is_active),
        'active_staff', (select count(*) from public.profiles f where f.tenant_id = p_tenant and f.status = 'active')) order by p.name)
      from public.properties p where p.tenant_id = p_tenant), '[]'::jsonb),
    'business_date_runs', coalesce((select jsonb_agg(x order by x.finished_at desc) from (
        select p.name as property, l.from_date, l.to_date, l.status, l.trigger, l.finished_at, left(l.error, 300) as error
        from public.business_date_log l join public.properties p on p.id = l.property_id
        where l.tenant_id = p_tenant order by l.finished_at desc limit 10) x), '[]'::jsonb),
    'messages', (select jsonb_build_object(
        'pending', count(*) filter (where o.status = 'pending'),
        'failed', count(*) filter (where o.status = 'failed'),
        'sent_last_24h', count(*) filter (where o.status = 'sent' and o.sent_at > now() - interval '24 hours'))
      from public.notification_outbox o where o.tenant_id = p_tenant),
    'access', jsonb_build_object('expires_at', g.expires_at, 'views', g.views + 1)
  ) into j;
  return j;
end $$;

revoke all on function app.support_grant_open(public.support_access_grants), app.support_status(public.support_access_grants),
  app.require_support_manager(),
  public.platform_request_support_access(uuid, text, integer), public.platform_support_requests(uuid),
  public.list_support_access(), public.decide_support_access(uuid, boolean, integer), public.revoke_support_access(uuid),
  public.platform_support_snapshot(uuid) from public, anon;
grant execute on function public.platform_request_support_access(uuid, text, integer), public.platform_support_requests(uuid),
  public.list_support_access(), public.decide_support_access(uuid, boolean, integer), public.revoke_support_access(uuid),
  public.platform_support_snapshot(uuid) to authenticated;

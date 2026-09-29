-- Outbox, CSV exports and extra reports.

-- 1. Outbox --------------------------------------------------------------
create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  property_id uuid references public.properties(id),
  channel text not null check (channel in ('email', 'sms', 'whatsapp')),
  recipient text not null,
  subject text,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0,
  max_attempts integer not null default 6,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  dedupe_key text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, dedupe_key)
);
create index notification_outbox_due on public.notification_outbox (next_attempt_at) where status = 'pending';

grant select on public.notification_outbox to authenticated;
grant all on public.notification_outbox to service_role;
alter table public.notification_outbox enable row level security;
create policy outbox_read on public.notification_outbox for select to authenticated
  using (tenant_id = app.my_tenant() and (app.can('adm.user.manage', null) or app.can('adm.audit.view', null)));

-- Only database functions add messages.
create or replace function app.enqueue_message(p_tenant uuid, p_property uuid, p_channel text, p_recipient text,
  p_subject text, p_body text, p_dedupe text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(btrim(p_recipient), '') = '' then return; end if;
  insert into public.notification_outbox(tenant_id, property_id, channel, recipient, subject, body, dedupe_key)
  values (p_tenant, p_property, p_channel, btrim(p_recipient), p_subject, p_body, p_dedupe)
  on conflict (tenant_id, dedupe_key) do nothing;
end $$;

-- Reservation confirmation email to the guest.
create or replace function app.outbox_reservation_confirmed()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare g public.guests; p public.properties;
begin
  if new.status <> 'confirmed' or (tg_op = 'UPDATE' and old.status = 'confirmed') then return new; end if;
  select * into g from public.guests where id = new.guest_id;
  if g.email is null or g.anonymised_at is not null then return new; end if;
  select * into p from public.properties where id = new.property_id;
  perform app.enqueue_message(new.tenant_id, new.property_id, 'email', g.email,
    'Your booking at ' || p.name || ' is confirmed (' || new.number || ')',
    'Dear ' || g.first_name || E',\n\nYour booking ' || new.number || ' at ' || p.name || ' is confirmed.' ||
    E'\nArrival: ' || to_char(new.arrival_date, 'Dy DD Mon YYYY') ||
    E'\nDeparture: ' || to_char(new.departure_date, 'Dy DD Mon YYYY') ||
    E'\nGuests: ' || new.adults || ' adult(s)' || case when new.children > 0 then ', ' || new.children || ' child(ren)' else '' end ||
    E'\n\nWe look forward to welcoming you.\n' || p.name,
    'res-confirm:' || new.id);
  return new;
end $$;
create trigger outbox_reservation_confirmed after insert or update of status on public.reservations
  for each row execute function app.outbox_reservation_confirmed();

-- Approval alert email to each approver notified.
create or replace function app.outbox_approval_alert()
returns trigger language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_email text;
begin
  if new.kind <> 'approval_requested' then return new; end if;
  select u.email into v_email from auth.users u
    join public.profiles pr on pr.id = u.id and pr.status = 'active' where u.id = new.user_id;
  perform app.enqueue_message(new.tenant_id, new.property_id, 'email', v_email, new.title,
    coalesce(new.body, '') || E'\n\nOpen Approvals in Hotel Desk to approve or reject.', 'notif:' || new.id);
  return new;
end $$;
create trigger outbox_approval_alert after insert on public.notifications
  for each row execute function app.outbox_approval_alert();

-- Status for the Admin page; also the permission gate for Run now.
create or replace function public.outbox_status()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_tenant uuid := app.my_tenant();
begin
  if v_tenant is null or not app.can('adm.user.manage', null) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to manage the message outbox.'); end if;
  return jsonb_build_object('tenant_id', v_tenant,
    'pending', (select count(*) from public.notification_outbox where tenant_id = v_tenant and status = 'pending'),
    'sent', (select count(*) from public.notification_outbox where tenant_id = v_tenant and status = 'sent'),
    'failed', (select count(*) from public.notification_outbox where tenant_id = v_tenant and status = 'failed'));
end $$;

-- Processor: claim a bounded batch (lease 5 min) ...
create or replace function public.outbox_claim(p_limit integer, p_channels text[], p_tenant uuid default null)
returns setof public.notification_outbox language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return query
  update public.notification_outbox o set attempts = o.attempts + 1, next_attempt_at = now() + interval '5 minutes'
  where o.id in (
    select id from public.notification_outbox
    where status = 'pending' and next_attempt_at <= now() and channel = any(p_channels)
      and (p_tenant is null or tenant_id = p_tenant)
    order by next_attempt_at limit least(greatest(p_limit, 1), 50)
    for update skip locked)
  returning o.*;
end $$;

-- ... and mark each: sent, retry with back-off (2,4,8.. min, max 60), or failed.
create or replace function public.outbox_mark(p_id uuid, p_ok boolean, p_error text default null, p_final boolean default false)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.notification_outbox set
    status = case when p_ok then 'sent' when p_final or attempts >= max_attempts then 'failed' else 'pending' end,
    sent_at = case when p_ok then now() else sent_at end,
    last_error = case when p_ok then null else left(p_error, 1000) end,
    next_attempt_at = case when p_ok then next_attempt_at
      else now() + make_interval(mins => least(60, power(2, attempts)::int)) end
  where id = p_id and status = 'pending';
end $$;

revoke all on function app.enqueue_message(uuid, uuid, text, text, text, text, text), app.outbox_reservation_confirmed(),
  app.outbox_approval_alert() from public, anon, authenticated;
revoke all on function public.outbox_claim(integer, text[], uuid), public.outbox_mark(uuid, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.outbox_claim(integer, text[], uuid), public.outbox_mark(uuid, boolean, text, boolean) to service_role;
revoke all on function public.outbox_status() from public, anon;
grant execute on function public.outbox_status() to authenticated;

-- 2. Exports -------------------------------------------------------------
insert into public.permissions(key, description, module) values ('rpt.export', 'Export data to CSV', 'reports')
on conflict (key) do nothing;
insert into public.role_permissions(role_id, permission_key, grant_level)
select r.id, 'rpt.export', 'Y' from public.roles r where r.tenant_id is null and r.code in ('SYSADMIN', 'GM', 'ACCT')
on conflict do nothing;

create or replace function public.export_data(p_kind text, p_property_id uuid, p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid := app.my_tenant(); v_rows jsonb;
begin
  if not exists (select 1 from public.properties where id = p_property_id and tenant_id = v_tenant)
     or not app.can('rpt.export', p_property_id) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to export data.'); end if;
  if p_kind not in ('reservations', 'transactions', 'guests') then perform app.fail('E_INVALID', 'Choose what to export.'); end if;
  if p_from is null or p_to is null or p_to < p_from then perform app.fail('E_INVALID', 'Choose a valid date range.'); end if;
  if p_to - p_from > 366 then perform app.fail('E_INVALID', 'Export at most one year at a time.'); end if;
  if p_kind = 'guests' and not app.can('guest.view', null) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to view guests.'); end if;

  if p_kind = 'reservations' then
    select coalesce(jsonb_agg(x order by x.arrival_date, x.number), '[]') into v_rows from (
      select r.number, r.status, nullif(btrim(coalesce(g.first_name,'') || ' ' || coalesce(g.last_name,'')), '') as guest,
        r.arrival_date, r.departure_date, (r.departure_date - r.arrival_date) as nights, rt.code as room_type, rp.code as rate_plan,
        r.adults, r.children, r.source, r.company_name, r.currency, r.total_amount, r.deposit_required, r.created_at
      from public.reservations r join public.guests g on g.id = r.guest_id
      join public.room_types rt on rt.id = r.room_type_id join public.rate_plans rp on rp.id = r.rate_plan_id
      where r.property_id = p_property_id and r.arrival_date between p_from and p_to) x;
  elsif p_kind = 'transactions' then
    select coalesce(jsonb_agg(x order by x.posted_at), '[]') into v_rows from (
      select t.business_date, t.posted_at, f.number as folio, r.number as reservation, t.kind, cc.code as charge_code,
        pm.name as payment_method, t.description, t.reference, t.currency, t.amount, t.fx_rate, t.base_amount,
        coalesce((select sum(tl.base_amount) from public.folio_tax_lines tl where tl.transaction_id = t.id), 0) as tax,
        t.is_deposit, t.id as transaction_id, t.original_id
      from public.folio_transactions t join public.folios f on f.id = t.folio_id join public.reservations r on r.id = f.reservation_id
      left join public.charge_codes cc on cc.id = t.charge_code_id left join public.payment_methods pm on pm.id = t.payment_method_id
      where t.property_id = p_property_id and t.business_date between p_from and p_to) x;
  else
    select coalesce(jsonb_agg(x order by x.last_name, x.first_name), '[]') into v_rows from (
      select g.id as guest_id, g.first_name, g.last_name, g.phone, g.email, g.nationality, g.status, g.created_at
      from public.guests g
      where g.tenant_id = v_tenant and exists (select 1 from public.reservations r where r.guest_id = g.id
        and r.property_id = p_property_id and r.arrival_date between p_from and p_to)) x;
  end if;

  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after)
  values (v_tenant, auth.uid(), 'export', p_kind, p_property_id::text,
    jsonb_build_object('property_id', p_property_id, 'from', p_from, 'to', p_to, 'rows', jsonb_array_length(v_rows)));
  return v_rows;
end $$;
revoke all on function public.export_data(text, uuid, date, date) from public, anon;
grant execute on function public.export_data(text, uuid, date, date) to authenticated;

-- 3. Reports -------------------------------------------------------------
create or replace function public.report_cancellation_rate(p_property_id uuid, p_from date, p_to date)
returns table(bookings bigint, cancelled bigint, no_shows bigint, cancellation_rate numeric, no_show_rate numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform app.require_report('rpt.operations.view', p_property_id);
  return query
  select count(*), count(*) filter (where r.status = 'cancelled'), count(*) filter (where r.status = 'no_show'),
    round(count(*) filter (where r.status = 'cancelled')::numeric / nullif(count(*), 0), 4),
    round(count(*) filter (where r.status = 'no_show')::numeric / nullif(count(*), 0), 4)
  from public.reservations r where r.property_id = p_property_id and r.arrival_date between p_from and p_to;
end $$;

create or replace function public.report_length_of_stay(p_property_id uuid, p_from date, p_to date)
returns table(stays bigint, total_nights bigint, average_nights numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform app.require_report('rpt.operations.view', p_property_id);
  return query
  select count(*), coalesce(sum(r.departure_date - r.arrival_date), 0)::bigint,
    round(avg(r.departure_date - r.arrival_date)::numeric, 2)
  from public.reservations r where r.property_id = p_property_id and r.arrival_date between p_from and p_to
    and r.status in ('checked_in', 'checked_out');
end $$;

create or replace function public.report_balances_by_guest(p_property_id uuid)
returns table(guest_id uuid, guest_name text, folios bigint, currency char(3), balance numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform app.require_report('rpt.finance.view', p_property_id);
  return query
  select b.guest_id, max(b.guest_name), count(*), b.currency, sum(b.balance)::numeric
  from public.v_folio_balances b where b.property_id = p_property_id and b.balance <> 0
  group by b.guest_id, b.currency having sum(b.balance) <> 0
  order by 5 desc;
end $$;

revoke all on function public.report_cancellation_rate(uuid, date, date), public.report_length_of_stay(uuid, date, date),
  public.report_balances_by_guest(uuid) from public, anon;
grant execute on function public.report_cancellation_rate(uuid, date, date), public.report_length_of_stay(uuid, date, date),
  public.report_balances_by_guest(uuid) to authenticated;

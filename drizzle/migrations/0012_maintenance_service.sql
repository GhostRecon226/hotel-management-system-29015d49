-- Maintenance tickets and guest service requests.

insert into public.permissions(key, description, module) values
  ('mnt.ticket.work', 'Work on and resolve maintenance tickets', 'maintenance'),
  ('svc.order.complete', 'Work on and complete service orders', 'service')
on conflict (key) do nothing;

insert into public.role_permissions(role_id, permission_key, grant_level)
select r.id, m.key, m.lvl from (values
  ('SYSADMIN','mnt.ticket.work','Y'),('SYSADMIN','svc.order.complete','Y'),
  ('GM','mnt.ticket.work','Y'),('GM','svc.order.complete','Y'),
  ('FOM','mnt.ticket.assign','Y'),('FOM','mnt.ticket.close','Y'),('FOM','svc.order.complete','Y'),
  ('HKS','mnt.ticket.assign','Y'),('HKS','mnt.ticket.close','Y'),
  ('MNT','mnt.ticket.work','Y'),
  ('FDO','svc.order.complete','Y'),('CASHIER','svc.order.complete','Y')
) as m(code, key, lvl)
join public.roles r on r.code = m.code and r.tenant_id is null
on conflict do nothing;

create table public.maintenance_tickets (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  property_id   uuid not null references public.properties(id) on delete cascade,
  title         text not null,
  description   text,
  room_id       uuid references public.rooms(id),
  location      text,
  priority      text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status        text not null default 'open' check (status in ('open', 'assigned', 'in_progress', 'waiting', 'resolved', 'closed', 'cancelled')),
  assignee_id   uuid references public.profiles(id),
  wait_reason   text,
  resolution    text,
  resolved_by   uuid references public.profiles(id),
  resolved_at   timestamptz,
  closed_by     uuid references public.profiles(id),
  closed_at     timestamptz,
  cancel_reason text,
  reopen_count  integer not null default 0,
  last_reopen_reason text,
  business_date date not null,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint maintenance_tickets_where check (room_id is not null or coalesce(btrim(location), '') <> ''),
  constraint maintenance_tickets_sod check (closed_by is null or resolved_by is null or closed_by <> resolved_by)
);
create index maintenance_tickets_property_idx on public.maintenance_tickets(property_id, status, created_at desc);
create index maintenance_tickets_room_idx on public.maintenance_tickets(room_id, status);
grant select on public.maintenance_tickets to authenticated;
grant all on public.maintenance_tickets to service_role;
alter table public.maintenance_tickets enable row level security;
create policy "Maintenance staff read tickets" on public.maintenance_tickets for select to authenticated
  using (tenant_id = app.my_tenant() and (app.can('mnt.view', property_id) or created_by = auth.uid() or assignee_id = auth.uid()));
create trigger maintenance_tickets_enforce_writable before insert or update or delete on public.maintenance_tickets
  for each row execute function app.enforce_writable();

alter table public.room_blocks add constraint room_blocks_ticket_fk
  foreign key (ticket_id) references public.maintenance_tickets(id) not valid;

create table public.service_requests (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  property_id     uuid not null references public.properties(id) on delete cascade,
  reservation_id  uuid not null references public.reservations(id),
  category        text not null check (category in ('food', 'laundry', 'housekeeping', 'amenities', 'transport', 'wake_up', 'other')),
  description     text not null,
  chargeable      boolean not null default false,
  charge_amount   numeric(20,4),
  currency        char(3) not null,
  charge_code_id  uuid references public.charge_codes(id),
  status          text not null default 'open' check (status in ('open', 'assigned', 'in_progress', 'completed', 'cancelled')),
  assignee_id     uuid references public.profiles(id),
  posted_transaction_id uuid references public.folio_transactions(id),
  completed_by    uuid references public.profiles(id),
  completed_at    timestamptz,
  cancel_reason   text,
  business_date   date not null,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  constraint service_requests_charge check (not chargeable or (charge_amount > 0 and charge_code_id is not null))
);
create index service_requests_property_idx on public.service_requests(property_id, status, created_at desc);
create unique index service_requests_posted_once on public.service_requests(posted_transaction_id) where posted_transaction_id is not null;
grant select on public.service_requests to authenticated;
grant all on public.service_requests to service_role;
alter table public.service_requests enable row level security;
create policy "Service staff read requests" on public.service_requests for select to authenticated
  using (tenant_id = app.my_tenant() and (app.can('svc.view', property_id) or assignee_id = auth.uid()));
create trigger service_requests_enforce_writable before insert or update or delete on public.service_requests
  for each row execute function app.enforce_writable();

create or replace function app.mnt_ticket_for_write(p_id uuid)
returns public.maintenance_tickets language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.maintenance_tickets;
begin
  select * into t from public.maintenance_tickets where id = p_id and tenant_id = app.my_tenant() for update;
  if t.id is null then perform app.fail('E_NOT_FOUND', 'Ticket not found.'); end if;
  return t;
end $$;

create or replace function app.svc_for_write(p_id uuid)
returns public.service_requests language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.service_requests;
begin
  select * into s from public.service_requests where id = p_id and tenant_id = app.my_tenant() for update;
  if s.id is null then perform app.fail('E_NOT_FOUND', 'Request not found.'); end if;
  return s;
end $$;

create or replace function app.notify_user(p_user uuid, p_tenant uuid, p_property uuid, p_kind text, p_title text, p_body text, p_link text, p_entity uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_user is null or p_user = auth.uid() then return; end if;
  insert into public.notifications(tenant_id, property_id, user_id, kind, title, body, link, entity_id)
  values (p_tenant, p_property, p_user, p_kind, p_title, p_body, p_link, p_entity);
end $$;

create or replace function app.assert_staff(p_user uuid, p_perm text, p_property uuid)
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if p_user is null then return; end if;
  if not exists (select 1 from public.user_property_roles upr
      join public.role_permissions rp on rp.role_id = upr.role_id and rp.permission_key = p_perm
      join public.profiles p on p.id = upr.user_id and p.status = 'active'
      where upr.user_id = p_user and upr.property_id = p_property and upr.tenant_id = app.my_tenant()) then
    perform app.fail('E_INVALID', 'That person cannot take this work.');
  end if;
end $$;

create or replace function public.create_ticket(p_property_id uuid, p_title text, p_description text, p_room_id uuid,
  p_location text, p_priority text default 'normal', p_assignee_id uuid default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.properties; v_id uuid;
begin
  perform app.assert_writable();
  perform app.require('mnt.ticket.create', p_property_id);
  select * into p from public.properties where id = p_property_id and tenant_id = app.my_tenant();
  if coalesce(btrim(p_title), '') = '' then perform app.fail('E_REQUIRED', 'Say what the problem is.'); end if;
  if coalesce(p_priority, 'normal') not in ('low', 'normal', 'high', 'urgent') then perform app.fail('E_INVALID', 'Choose a priority.'); end if;
  if p_room_id is not null and not exists (select 1 from public.rooms where id = p_room_id and property_id = p.id) then
    perform app.fail('E_INVALID', 'Room not found.'); end if;
  if p_room_id is null and coalesce(btrim(p_location), '') = '' then perform app.fail('E_REQUIRED', 'Pick a room or type a location.'); end if;
  if p_assignee_id is not null then
    perform app.require('mnt.ticket.assign', p.id);
    perform app.assert_staff(p_assignee_id, 'mnt.ticket.work', p.id);
  end if;
  insert into public.maintenance_tickets(tenant_id, property_id, title, description, room_id, location, priority, status, assignee_id, business_date)
  values (p.tenant_id, p.id, btrim(p_title), nullif(btrim(p_description), ''), p_room_id, nullif(btrim(p_location), ''),
    coalesce(p_priority, 'normal'), case when p_assignee_id is null then 'open' else 'assigned' end, p_assignee_id, p.business_date)
  returning id into v_id;
  perform app.notify_user(p_assignee_id, p.tenant_id, p.id, 'mnt_ticket', 'Maintenance ticket assigned to you', btrim(p_title), '/maintenance/' || v_id, v_id);
  return v_id;
end $$;

create or replace function public.assign_ticket(p_id uuid, p_assignee_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.maintenance_tickets;
begin
  perform app.assert_writable();
  t := app.mnt_ticket_for_write(p_id);
  perform app.require('mnt.ticket.assign', t.property_id);
  if t.status not in ('open', 'assigned', 'waiting', 'in_progress') then perform app.fail('E_INVALID', 'This ticket cannot be reassigned.'); end if;
  perform app.assert_staff(p_assignee_id, 'mnt.ticket.work', t.property_id);
  update public.maintenance_tickets set assignee_id = p_assignee_id, updated_at = now(),
    status = case when t.status in ('open', 'assigned') then (case when p_assignee_id is null then 'open' else 'assigned' end) else t.status end
  where id = t.id;
  perform app.notify_user(p_assignee_id, t.tenant_id, t.property_id, 'mnt_ticket', 'Maintenance ticket assigned to you', t.title, '/maintenance/' || t.id, t.id);
end $$;

create or replace function app.mnt_require_worker(t public.maintenance_tickets)
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform app.require('mnt.ticket.work', t.property_id);
  if t.assignee_id is distinct from auth.uid() and not app.can('mnt.ticket.assign', t.property_id) then
    perform app.fail('E_FORBIDDEN', 'This ticket is assigned to someone else.'); end if;
end $$;

create or replace function public.start_ticket(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.maintenance_tickets;
begin
  perform app.assert_writable();
  t := app.mnt_ticket_for_write(p_id);
  perform app.mnt_require_worker(t);
  if t.status not in ('open', 'assigned', 'waiting') then perform app.fail('E_INVALID', 'Only open, assigned or waiting tickets can be started.'); end if;
  update public.maintenance_tickets set status = 'in_progress', assignee_id = coalesce(t.assignee_id, auth.uid()), wait_reason = null, updated_at = now()
  where id = t.id;
end $$;

create or replace function public.wait_ticket(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.maintenance_tickets;
begin
  perform app.assert_writable();
  t := app.mnt_ticket_for_write(p_id);
  perform app.mnt_require_worker(t);
  if t.status not in ('assigned', 'in_progress') then perform app.fail('E_INVALID', 'Only assigned or in-progress tickets can be put on hold.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'Say what you are waiting for.'); end if;
  update public.maintenance_tickets set status = 'waiting', wait_reason = btrim(p_reason), updated_at = now() where id = t.id;
end $$;

create or replace function public.resolve_ticket(p_id uuid, p_resolution text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.maintenance_tickets;
begin
  perform app.assert_writable();
  t := app.mnt_ticket_for_write(p_id);
  perform app.mnt_require_worker(t);
  if t.status not in ('assigned', 'in_progress', 'waiting') then perform app.fail('E_INVALID', 'This ticket cannot be resolved now.'); end if;
  if coalesce(btrim(p_resolution), '') = '' then perform app.fail('E_REQUIRED', 'Say what was done.'); end if;
  update public.maintenance_tickets set status = 'resolved', resolution = btrim(p_resolution), resolved_by = auth.uid(),
    resolved_at = now(), wait_reason = null, updated_at = now() where id = t.id;
  perform app.notify_user(t.created_by, t.tenant_id, t.property_id, 'mnt_ticket', 'Maintenance ticket resolved', t.title, '/maintenance/' || t.id, t.id);
end $$;

create or replace function public.close_ticket(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.maintenance_tickets;
begin
  perform app.assert_writable();
  t := app.mnt_ticket_for_write(p_id);
  perform app.require('mnt.ticket.close', t.property_id);
  if t.status <> 'resolved' then perform app.fail('E_INVALID', 'Only resolved tickets can be closed.'); end if;
  if t.resolved_by = auth.uid() then
    perform app.fail('E_SOD', 'You resolved this ticket, so someone else must check and close it.'); end if;
  update public.maintenance_tickets set status = 'closed', closed_by = auth.uid(), closed_at = now(), updated_at = now() where id = t.id;
end $$;

create or replace function public.reopen_ticket(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.maintenance_tickets;
begin
  perform app.assert_writable();
  t := app.mnt_ticket_for_write(p_id);
  perform app.require('mnt.ticket.close', t.property_id);
  if t.status not in ('resolved', 'closed') then perform app.fail('E_INVALID', 'Only resolved or closed tickets can be reopened.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, before, after, reason)
  values (t.tenant_id, auth.uid(), 'ticket.reopen', 'maintenance_tickets', t.id::text,
    jsonb_build_object('status', t.status, 'resolved_by', t.resolved_by, 'resolution', t.resolution, 'closed_by', t.closed_by),
    jsonb_build_object('status', case when t.assignee_id is null then 'open' else 'assigned' end), btrim(p_reason));
  update public.maintenance_tickets set status = case when t.assignee_id is null then 'open' else 'assigned' end,
    resolved_by = null, resolved_at = null, closed_by = null, closed_at = null,
    reopen_count = t.reopen_count + 1, last_reopen_reason = btrim(p_reason), updated_at = now() where id = t.id;
  perform app.notify_user(t.assignee_id, t.tenant_id, t.property_id, 'mnt_ticket', 'Maintenance ticket reopened', t.title, '/maintenance/' || t.id, t.id);
end $$;

create or replace function public.cancel_ticket(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.maintenance_tickets;
begin
  perform app.assert_writable();
  t := app.mnt_ticket_for_write(p_id);
  if not (app.can('mnt.ticket.assign', t.property_id) or (t.created_by = auth.uid() and t.status = 'open')) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to cancel this ticket.'); end if;
  if t.status in ('resolved', 'closed', 'cancelled') then perform app.fail('E_INVALID', 'This ticket is already finished.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  update public.maintenance_tickets set status = 'cancelled', cancel_reason = btrim(p_reason), updated_at = now() where id = t.id;
end $$;

create or replace function public.block_room_for_ticket(p_id uuid, p_type text, p_from date, p_to date, p_reason text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.maintenance_tickets;
begin
  t := app.mnt_ticket_for_write(p_id);
  if t.room_id is null then perform app.fail('E_INVALID', 'This ticket is not linked to a room.'); end if;
  if t.status in ('closed', 'cancelled') then perform app.fail('E_INVALID', 'This ticket is finished.'); end if;
  return public.request_room_block(t.room_id, p_type, p_from, p_to,
    coalesce(nullif(btrim(p_reason), ''), 'Maintenance: ' || t.title), t.id);
end $$;

create or replace function public.mnt_staff(p_property_id uuid)
returns table(id uuid, full_name text) language sql stable security definer set search_path = public, pg_temp as $$
  select distinct p.id, p.full_name from public.user_property_roles upr
  join public.role_permissions rp on rp.role_id = upr.role_id and rp.permission_key = 'mnt.ticket.work'
  join public.profiles p on p.id = upr.user_id and p.status = 'active'
  where upr.property_id = p_property_id and upr.tenant_id = app.my_tenant() and app.can('mnt.view', p_property_id)
  order by p.full_name
$$;

create or replace function public.create_service_request(p_reservation_id uuid, p_category text, p_description text,
  p_chargeable boolean default false, p_charge_amount numeric default null, p_charge_code_id uuid default null,
  p_assignee_id uuid default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; p public.properties; v_id uuid;
begin
  perform app.assert_writable();
  select * into r from public.reservations where id = p_reservation_id and tenant_id = app.my_tenant();
  if r.id is null then perform app.fail('E_NOT_FOUND', 'Booking not found.'); end if;
  perform app.require('svc.order.create', r.property_id);
  if r.status <> 'checked_in' then perform app.fail('E_INVALID', 'Service requests are only for guests in house.'); end if;
  select * into p from public.properties where id = r.property_id;
  if p_category not in ('food', 'laundry', 'housekeeping', 'amenities', 'transport', 'wake_up', 'other') then
    perform app.fail('E_INVALID', 'Choose a category.'); end if;
  if coalesce(btrim(p_description), '') = '' then perform app.fail('E_REQUIRED', 'Describe the request.'); end if;
  if coalesce(p_chargeable, false) then
    if p_charge_amount is null or p_charge_amount <= 0 then perform app.fail('E_INVALID', 'Enter the charge amount.'); end if;
    if not exists (select 1 from public.charge_codes where id = p_charge_code_id and property_id = p.id and is_active) then
      perform app.fail('E_INVALID', 'Choose a charge code.'); end if;
  end if;
  perform app.assert_staff(p_assignee_id, 'svc.order.complete', p.id);
  insert into public.service_requests(tenant_id, property_id, reservation_id, category, description, chargeable, charge_amount,
    currency, charge_code_id, status, assignee_id, business_date)
  values (p.tenant_id, p.id, r.id, p_category, btrim(p_description), coalesce(p_chargeable, false),
    case when p_chargeable then round(p_charge_amount, 2) end, p.base_currency,
    case when p_chargeable then p_charge_code_id end,
    case when p_assignee_id is null then 'open' else 'assigned' end, p_assignee_id, p.business_date)
  returning id into v_id;
  perform app.notify_user(p_assignee_id, p.tenant_id, p.id, 'svc_request', 'Service request assigned to you', btrim(p_description), '/service-requests', v_id);
  return v_id;
end $$;

create or replace function public.assign_service_request(p_id uuid, p_assignee_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.service_requests;
begin
  perform app.assert_writable();
  s := app.svc_for_write(p_id);
  perform app.require('svc.order.create', s.property_id);
  if s.status not in ('open', 'assigned', 'in_progress') then perform app.fail('E_INVALID', 'This request is finished.'); end if;
  perform app.assert_staff(p_assignee_id, 'svc.order.complete', s.property_id);
  update public.service_requests set assignee_id = p_assignee_id,
    status = case when s.status = 'in_progress' then s.status when p_assignee_id is null then 'open' else 'assigned' end
  where id = s.id;
  perform app.notify_user(p_assignee_id, s.tenant_id, s.property_id, 'svc_request', 'Service request assigned to you', s.description, '/service-requests', s.id);
end $$;

create or replace function public.start_service_request(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.service_requests;
begin
  perform app.assert_writable();
  s := app.svc_for_write(p_id);
  perform app.require('svc.order.complete', s.property_id);
  if s.status not in ('open', 'assigned') then perform app.fail('E_INVALID', 'Only open or assigned requests can be started.'); end if;
  update public.service_requests set status = 'in_progress', assignee_id = coalesce(s.assignee_id, auth.uid()) where id = s.id;
end $$;

create or replace function public.complete_service_request(p_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.service_requests; cc public.charge_codes; v_folio uuid; v_key text; v_id uuid; l record; v_date date;
begin
  perform app.assert_writable();
  s := app.svc_for_write(p_id);
  perform app.require('svc.order.complete', s.property_id);
  if s.status = 'completed' then return s.posted_transaction_id; end if;
  if s.status not in ('open', 'assigned', 'in_progress') then perform app.fail('E_INVALID', 'This request was cancelled.'); end if;
  if s.chargeable then
    v_key := 'svc:' || s.id;
    select id into v_id from public.folio_transactions where tenant_id = s.tenant_id and idempotency_key = v_key;
    if v_id is null then
      select * into cc from public.charge_codes where id = s.charge_code_id;
      v_folio := app.ensure_main_folio(s.reservation_id);
      if (select status from public.folios where id = v_folio) <> 'open' then
        perform app.fail('E_INVALID', 'The guest''s main folio is closed. Reopen it before completing this request.'); end if;
      select business_date into v_date from public.properties where id = s.property_id;
      create temp table if not exists _svc_tax (line_no int, tax_code text, tax_name text, percent numeric, taxable_base numeric, amount numeric) on commit drop;
      delete from _svc_tax;
      if cc.is_taxable then insert into _svc_tax select * from public.calculate_tax(s.property_id, round(s.charge_amount, 2), false); end if;
      insert into public.folio_transactions(tenant_id, property_id, folio_id, kind, charge_code_id, amount, currency, fx_rate,
        base_amount, tax_inclusive, description, reference, idempotency_key, business_date)
      values (s.tenant_id, s.property_id, v_folio, 'charge', cc.id, round(s.charge_amount, 2), s.currency, 1, round(s.charge_amount, 2), false,
        cc.name || ' · ' || left(s.description, 80), 'Service request', v_key, v_date)
      returning id into v_id;
      for l in select * from _svc_tax order by line_no loop
        insert into public.folio_tax_lines(tenant_id, property_id, transaction_id, line_no, tax_code, tax_name, percent, taxable_base, amount, base_amount)
        values (s.tenant_id, s.property_id, v_id, l.line_no, l.tax_code, l.tax_name, l.percent, l.taxable_base, l.amount, l.amount);
      end loop;
    end if;
  end if;
  update public.service_requests set status = 'completed', completed_by = auth.uid(), completed_at = now(),
    assignee_id = coalesce(s.assignee_id, auth.uid()), posted_transaction_id = v_id where id = s.id;
  return v_id;
end $$;

create or replace function public.cancel_service_request(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.service_requests;
begin
  perform app.assert_writable();
  s := app.svc_for_write(p_id);
  if not (app.can('svc.order.cancel', s.property_id) or (s.created_by = auth.uid() and s.status = 'open')) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to cancel this request.'); end if;
  if s.status in ('completed', 'cancelled') then perform app.fail('E_INVALID', 'This request is already finished.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  update public.service_requests set status = 'cancelled', cancel_reason = btrim(p_reason) where id = s.id;
end $$;

create or replace function public.svc_staff(p_property_id uuid)
returns table(id uuid, full_name text) language sql stable security definer set search_path = public, pg_temp as $$
  select distinct p.id, p.full_name from public.user_property_roles upr
  join public.role_permissions rp on rp.role_id = upr.role_id and rp.permission_key = 'svc.order.complete'
  join public.profiles p on p.id = upr.user_id and p.status = 'active'
  where upr.property_id = p_property_id and upr.tenant_id = app.my_tenant() and app.can('svc.view', p_property_id)
  order by p.full_name
$$;

create or replace view public.v_maintenance_tickets with (security_invoker = true) as
select t.*, r.room_number, pa.full_name as assignee_name, pr.full_name as resolved_by_name,
  pcl.full_name as closed_by_name, pcr.full_name as created_by_name,
  exists (select 1 from public.room_blocks b where b.ticket_id = t.id and b.status in ('pending', 'approved')) as has_active_block
from public.maintenance_tickets t
left join public.rooms r on r.id = t.room_id
left join public.profiles pa on pa.id = t.assignee_id
left join public.profiles pr on pr.id = t.resolved_by
left join public.profiles pcl on pcl.id = t.closed_by
left join public.profiles pcr on pcr.id = t.created_by;
grant select on public.v_maintenance_tickets to authenticated;

create or replace view public.v_service_requests with (security_invoker = true) as
select s.*, res.number as reservation_number,
  nullif(btrim(coalesce(g.first_name, '') || ' ' || coalesce(g.last_name, '')), '') as guest_name,
  (select rm.room_number from public.stays st join public.rooms rm on rm.id = st.room_id
    where st.reservation_id = s.reservation_id order by (st.status = 'in_house') desc, st.checked_in_at desc limit 1) as room_number,
  cc.name as charge_code_name, pa.full_name as assignee_name, pc.full_name as completed_by_name
from public.service_requests s
join public.reservations res on res.id = s.reservation_id
left join public.guests g on g.id = res.guest_id
left join public.charge_codes cc on cc.id = s.charge_code_id
left join public.profiles pa on pa.id = s.assignee_id
left join public.profiles pc on pc.id = s.completed_by;
grant select on public.v_service_requests to authenticated;

revoke all on function app.mnt_ticket_for_write(uuid), app.svc_for_write(uuid),
  app.notify_user(uuid, uuid, uuid, text, text, text, text, uuid), app.assert_staff(uuid, text, uuid),
  app.mnt_require_worker(public.maintenance_tickets) from public;
revoke all on function public.create_ticket(uuid, text, text, uuid, text, text, uuid), public.assign_ticket(uuid, uuid),
  public.start_ticket(uuid), public.wait_ticket(uuid, text), public.resolve_ticket(uuid, text), public.close_ticket(uuid),
  public.reopen_ticket(uuid, text), public.cancel_ticket(uuid, text), public.block_room_for_ticket(uuid, text, date, date, text),
  public.mnt_staff(uuid), public.create_service_request(uuid, text, text, boolean, numeric, uuid, uuid),
  public.assign_service_request(uuid, uuid), public.start_service_request(uuid), public.complete_service_request(uuid),
  public.cancel_service_request(uuid, text), public.svc_staff(uuid) from public, anon;
grant execute on function public.create_ticket(uuid, text, text, uuid, text, text, uuid), public.assign_ticket(uuid, uuid),
  public.start_ticket(uuid), public.wait_ticket(uuid, text), public.resolve_ticket(uuid, text), public.close_ticket(uuid),
  public.reopen_ticket(uuid, text), public.cancel_ticket(uuid, text), public.block_room_for_ticket(uuid, text, date, date, text),
  public.mnt_staff(uuid), public.create_service_request(uuid, text, text, boolean, numeric, uuid, uuid),
  public.assign_service_request(uuid, uuid), public.start_service_request(uuid), public.complete_service_request(uuid),
  public.cancel_service_request(uuid, text), public.svc_staff(uuid) to authenticated;

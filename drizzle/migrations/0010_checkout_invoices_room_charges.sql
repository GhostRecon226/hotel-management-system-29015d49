-- Check-out, unsettled check-out approvals, undo check-out, housekeeping turnover tasks,
-- invoices with per-tax-line split, and the nightly room charge.

insert into public.permissions(key, description, module) values
  ('fo.checkout.unsettled', 'Approve a check-out that still has a balance', 'front_office'),
  ('fo.checkout.undo',      'Undo a check-out on the same business day',     'front_office')
on conflict (key) do nothing;

insert into public.role_permissions(role_id, permission_key, grant_level)
select r.id, k.key, 'Y' from public.roles r
cross join (values ('fo.checkout.unsettled'), ('fo.checkout.undo')) k(key)
where r.tenant_id is null and r.code in ('SYSADMIN', 'GM', 'FOM')
on conflict do nothing;

insert into public.role_permissions(role_id, permission_key, grant_level)
select r.id, 'fo.checkout.unsettled', 'Y' from public.roles r
where r.tenant_id is null and r.code = 'ACCT'
on conflict do nothing;

alter table public.stays add column if not exists checkout_business_date date;
alter table public.stays add column if not exists checkout_approval_id uuid references public.approvals(id);
alter table public.stays add column if not exists checkout_reason text;
alter table public.stays add column if not exists checkout_snapshot jsonb;
alter table public.stays add column if not exists checked_out_by uuid;
create unique index if not exists stays_checkout_approval_once on public.stays(checkout_approval_id) where checkout_approval_id is not null;

alter table public.approvals drop constraint if exists approvals_kind_check;
alter table public.approvals add constraint approvals_kind_check
  check (kind in ('discount', 'adjustment', 'reversal', 'refund', 'checkout'));
alter table public.approvals add column if not exists reservation_id uuid references public.reservations(id);
create unique index if not exists approvals_one_pending_checkout on public.approvals(reservation_id) where status = 'pending' and kind = 'checkout';

create or replace function app.approve_perm(p_kind text)
returns text language sql immutable as $$
  select case p_kind when 'discount' then 'fin.discount.approve' when 'adjustment' then 'fin.adjust.approve'
    when 'reversal' then 'fin.reverse.approve' when 'refund' then 'fin.refund.approve'
    when 'checkout' then 'fo.checkout.unsettled' end
$$;

create table public.housekeeping_tasks (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  property_id   uuid not null references public.properties(id) on delete cascade,
  room_id       uuid not null references public.rooms(id),
  stay_id       uuid references public.stays(id),
  kind          text not null default 'turnover' check (kind in ('turnover', 'stayover', 'inspection', 'other')),
  status        text not null default 'open' check (status in ('open', 'in_progress', 'done', 'cancelled')),
  business_date date not null,
  notes         text,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);
create index housekeeping_tasks_room_idx on public.housekeeping_tasks(room_id, status);
create index housekeeping_tasks_property_idx on public.housekeeping_tasks(property_id, status, business_date);
grant select on public.housekeeping_tasks to authenticated;
grant all on public.housekeeping_tasks to service_role;
alter table public.housekeeping_tasks enable row level security;
create policy "Housekeeping and front desk read tasks" on public.housekeeping_tasks for select to authenticated
  using (tenant_id = app.my_tenant() and (app.can('hk.view', property_id) or app.can('fo.view', property_id)));
create trigger housekeeping_tasks_enforce_writable before insert or update or delete on public.housekeeping_tasks
  for each row execute function app.enforce_writable();

-- Settlement/check-out run while read-only: they set a transaction-local flag the write trigger honours.
create or replace function app.enforce_writable()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid;
begin
  if auth.uid() is null or coalesce(current_setting('app.settlement', true), '') = 'on' then return coalesce(new, old); end if;
  v_tenant := coalesce((to_jsonb(coalesce(new, old))->>'tenant_id')::uuid, null);
  if v_tenant is not null and not app.tenant_writable(v_tenant) then
    perform app.fail('E_READ_ONLY',
      'Your subscription is expired or suspended, so the hotel is read-only. Settlement and check-out are still allowed.');
  end if;
  return coalesce(new, old);
end $$;

create or replace function app.reservation_outstanding(p_res uuid)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(sum(abs(app.folio_balance(f.id))), 0) from public.folios f where f.reservation_id = p_res
$$;

create or replace function public.request_unsettled_checkout(p_id uuid, p_reason text, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; v_existing uuid; v_out numeric; v_folio uuid; f public.folios; a public.approvals;
begin
  perform app.assert_writable(true);
  v_existing := app.request_prelude(p_reason, p_idempotency_key);
  if v_existing is not null then return jsonb_build_object('status', 'pending', 'approval_id', v_existing); end if;
  r := app.reservation_for_write(p_id, 'fo.checkout');
  perform set_config('app.settlement', 'on', true);
  if r.status <> 'checked_in' then perform app.fail('E_INVALID', 'Only in-house guests can be checked out.'); end if;
  v_out := app.reservation_outstanding(r.id);
  if v_out = 0 then perform app.fail('E_INVALID', 'All folios are settled. Check the guest out directly.'); end if;
  select id into v_existing from public.approvals where reservation_id = r.id and kind = 'checkout' and status = 'pending';
  if v_existing is not null then perform app.fail('E_INVALID', 'A check-out approval is already waiting for this booking.'); end if;
  v_folio := app.ensure_main_folio(r.id);
  select * into f from public.folios where id = v_folio;
  insert into public.approvals(tenant_id, property_id, kind, entity, folio_id, reservation_id, payload, amount, currency, reason, idempotency_key)
  values (r.tenant_id, r.property_id, 'checkout', 'reservation', f.id, r.id, jsonb_build_object('reservation_id', r.id),
    v_out, f.currency, btrim(p_reason), p_idempotency_key)
  returning * into a;
  perform app.notify_approvers(a);
  return jsonb_build_object('status', 'pending', 'approval_id', a.id);
end $$;

create or replace function public.check_out(p_id uuid, p_approval_id uuid default null, p_reason text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; s public.stays; v_bdate date; v_out numeric; a public.approvals;
  v_closed uuid[] := '{}'; v_nights jsonb; v_old_dep date; fo record; v_task uuid; v_sid uuid;
begin
  perform app.assert_writable(true);
  r := app.reservation_for_write(p_id, 'fo.checkout');
  perform set_config('app.settlement', 'on', true);
  if r.status = 'checked_out' then
    select id into v_sid from public.stays where reservation_id = r.id and status = 'checked_out' order by checked_out_at desc limit 1;
    return v_sid;
  end if;
  if r.status <> 'checked_in' then perform app.fail('E_INVALID', 'Only in-house guests can be checked out.'); end if;
  select * into s from public.stays where reservation_id = r.id and status = 'in_house' for update;
  select business_date into v_bdate from public.properties where id = r.property_id;

  v_out := app.reservation_outstanding(r.id);
  if v_out <> 0 then
    if p_approval_id is not null then
      select * into a from public.approvals where id = p_approval_id and tenant_id = r.tenant_id for update;
      if a.id is null or a.kind <> 'checkout' or a.reservation_id <> r.id then
        perform app.fail('E_INVALID', 'That approval is not for this booking.'); end if;
      if a.status <> 'approved' then perform app.fail('E_NOT_APPROVED', 'The check-out approval has not been approved yet.'); end if;
      if exists (select 1 from public.stays where checkout_approval_id = a.id) then
        perform app.fail('E_INVALID', 'That approval has already been used.'); end if;
      if v_out > a.amount then
        perform app.fail('E_BALANCE_DUE', 'The balance has grown since approval (' || to_char(v_out, 'FM999,999,999,990.00') || '). Ask again.'); end if;
    elsif app.can('fo.checkout.unsettled', r.property_id) then
      if coalesce(btrim(p_reason), '') = '' then
        perform app.fail('E_REQUIRED', 'A reason is required to check out with a balance.'); end if;
    else
      perform app.fail('E_BALANCE_DUE', 'Every folio must be at zero. Outstanding: ' || to_char(v_out, 'FM999,999,999,990.00') || '. Settle it or ask for approval.');
    end if;
  end if;

  for fo in select id from public.folios where reservation_id = r.id and status = 'open' for update loop
    if app.folio_balance(fo.id) = 0 then
      update public.folios set status = 'closed', closed_at = now(), closed_by = auth.uid() where id = fo.id;
      v_closed := v_closed || fo.id;
    end if;
  end loop;

  v_old_dep := r.departure_date;
  select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb) into v_nights
    from public.reservation_nights n where n.reservation_id = r.id and n.stay_date >= v_bdate;
  delete from public.reservation_nights where reservation_id = r.id and stay_date >= v_bdate;
  update public.reservations set status = 'checked_out', updated_at = now(),
    departure_date = case when v_bdate > arrival_date and v_bdate < departure_date then v_bdate else departure_date end
  where id = r.id;

  update public.room_assignments set is_active = false, released_at = now() where reservation_id = r.id and is_active;
  update public.rooms set is_occupied = false, condition = 'dirty' where id = s.room_id;

  insert into public.housekeeping_tasks(tenant_id, property_id, room_id, stay_id, kind, business_date, notes)
  values (r.tenant_id, r.property_id, s.room_id, s.id, 'turnover', v_bdate, 'Check-out ' || r.number)
  returning id into v_task;

  update public.stays set status = 'checked_out', checked_out_at = now(), checked_out_by = auth.uid(),
    checkout_business_date = v_bdate, checkout_approval_id = a.id, checkout_reason = nullif(btrim(p_reason), ''),
    checkout_snapshot = jsonb_build_object('closed_folios', to_jsonb(v_closed), 'nights', v_nights,
      'departure_date', v_old_dep, 'task_id', v_task, 'outstanding', v_out)
  where id = s.id;

  perform app.log_res(r, 'check_out', p_reason, jsonb_strip_nulls(jsonb_build_object(
    'outstanding', nullif(v_out, 0), 'approval_id', a.id, 'closed_folios', cardinality(v_closed))));
  return s.id;
end $$;

create or replace function public.undo_checkout(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; s public.stays; v_bdate date; rm public.rooms; v_dep date; n jsonb; v_f text;
begin
  perform app.assert_writable();
  r := app.reservation_for_write(p_id, 'fo.checkout.undo');
  if r.status <> 'checked_out' then perform app.fail('E_INVALID', 'This booking is not checked out.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  select * into s from public.stays where reservation_id = r.id and status = 'checked_out' order by checked_out_at desc limit 1 for update;
  select business_date into v_bdate from public.properties where id = r.property_id;
  if s.checkout_business_date is distinct from v_bdate then
    perform app.fail('E_INVALID', 'A check-out can only be undone on the same business day.'); end if;
  select * into rm from public.rooms where id = s.room_id for update;
  if rm.is_occupied then perform app.fail('E_ROOM_TAKEN', 'Room ' || rm.room_number || ' is occupied again. Undo is not possible.'); end if;

  v_dep := coalesce((s.checkout_snapshot->>'departure_date')::date, r.departure_date);
  if v_dep > v_bdate then
    perform app.assert_available(r.property_id, r.room_type_id, v_bdate, v_dep, r.id);
  end if;

  update public.reservations set status = 'checked_in', departure_date = v_dep, updated_at = now() where id = r.id;
  for n in select * from jsonb_array_elements(coalesce(s.checkout_snapshot->'nights', '[]'::jsonb)) loop
    insert into public.reservation_nights(tenant_id, property_id, reservation_id, room_type_id, stay_date, rate_amount, room_id)
    values (r.tenant_id, r.property_id, r.id, (n->>'room_type_id')::uuid, (n->>'stay_date')::date, (n->>'rate_amount')::numeric, s.room_id)
    on conflict do nothing;
  end loop;
  begin
    insert into public.room_assignments(tenant_id, property_id, reservation_id, room_id, from_date, to_date)
    values (r.tenant_id, r.property_id, r.id, s.room_id, least(v_bdate, v_dep - 1), greatest(v_dep, v_bdate + 1));
  exception when exclusion_violation or unique_violation then
    perform app.fail('E_ROOM_TAKEN', 'Room ' || rm.room_number || ' has been assigned to another booking.');
  end;

  update public.rooms set is_occupied = true where id = s.room_id;
  update public.housekeeping_tasks set status = 'cancelled'
   where id = (s.checkout_snapshot->>'task_id')::uuid and status in ('open', 'in_progress');
  perform set_config('app.audit_reason', 'Undo check-out: ' || btrim(p_reason), true);
  for v_f in select jsonb_array_elements_text(coalesce(s.checkout_snapshot->'closed_folios', '[]'::jsonb)) loop
    update public.folios set status = 'open', closed_at = null, closed_by = null where id = v_f::uuid and status = 'closed';
  end loop;
  perform set_config('app.audit_reason', '', true);
  update public.stays set status = 'in_house', checked_out_at = null, checked_out_by = null, checkout_business_date = null,
    checkout_approval_id = null, checkout_reason = null, checkout_snapshot = null where id = s.id;
  perform app.log_res(r, 'undo_check_out', p_reason, null);
end $$;

create or replace function public.decide_approval(p_id uuid, p_approve boolean, p_reason text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.approvals; v_perm text; v_limit numeric; v_tx uuid; t public.folio_transactions; c public.folio_transactions;
begin
  select * into a from public.approvals where id = p_id and tenant_id = app.my_tenant() for update;
  if a.id is null then perform app.fail('E_NOT_FOUND', 'Request not found.'); end if;
  perform app.assert_writable(a.kind in ('refund', 'checkout') or not p_approve);
  if a.status <> 'pending' then perform app.fail('E_INVALID', 'This request has already been decided or withdrawn.'); end if;
  if a.requested_by = auth.uid() then
    perform app.fail('E_SOD', 'You cannot approve or reject your own request. Another approver must decide it.'); end if;
  v_perm := app.approve_perm(a.kind);
  perform app.require(v_perm, a.property_id);
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;

  if p_approve and a.kind <> 'checkout' then
    v_limit := app.approval_limit(v_perm, a.property_id);
    if v_limit is not null and abs(a.amount) > v_limit then
      perform app.fail('E_LIMIT', 'This amount is above your approval limit.'); end if;
    if a.kind = 'discount' then
      select * into c from public.folio_transactions where id = a.transaction_id;
      v_tx := app.post_discount(c, a.amount, a.reason, 'approval:' || a.id);
    elsif a.kind = 'reversal' then
      select * into t from public.folio_transactions where id = a.transaction_id;
      v_tx := app.post_reversal(t, a.reason, 'approval:' || a.id);
    elsif a.kind = 'adjustment' then
      v_tx := app.post_adjustment(a, 'approval:' || a.id);
    else
      v_tx := app.post_refund(a, 'approval:' || a.id);
    end if;
  end if;

  update public.approvals set status = case when p_approve then 'approved' else 'rejected' end,
    decided_by = auth.uid(), decided_at = now(), decision_reason = btrim(p_reason), posted_transaction_id = v_tx
  where id = a.id;

  insert into public.notifications(tenant_id, property_id, user_id, kind, title, body, link, entity_id)
  values (a.tenant_id, a.property_id, a.requested_by, 'approval_decided',
    case when a.kind = 'checkout' then 'Check-out with balance' else initcap(a.kind) end
      || case when p_approve then ' approved' else ' rejected' end,
    btrim(p_reason), case when a.kind = 'checkout' then '/checkout/' || a.reservation_id else '/approvals' end, a.id);
  return v_tx;
end $$;

create or replace view public.v_approvals with (security_invoker = true) as
select a.id, a.property_id, a.kind, a.folio_id, f.number as folio_number, f.reservation_id, a.transaction_id,
  t.description as transaction_description, a.amount, a.currency, a.reason, a.status, a.requested_by,
  rq.full_name as requested_by_name, a.requested_at, a.decided_by, dc.full_name as decided_by_name, a.decided_at,
  a.decision_reason, a.posted_transaction_id,
  nullif(btrim(coalesce(g.first_name, '') || ' ' || coalesce(g.last_name, '')), '') as guest_name,
  exists (select 1 from public.stays s where s.checkout_approval_id = a.id) as is_used
from public.approvals a
join public.folios f on f.id = a.folio_id
left join public.folio_transactions t on t.id = a.transaction_id
left join public.profiles rq on rq.id = a.requested_by
left join public.profiles dc on dc.id = a.decided_by
left join public.guests g on g.id = f.guest_id;
grant select on public.v_approvals to authenticated, service_role;

create table public.invoices (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  property_id      uuid not null references public.properties(id) on delete cascade,
  folio_id         uuid not null references public.folios(id),
  number           text not null,
  kind             text not null check (kind in ('interim', 'final')),
  currency         character(3) not null,
  issued_at        timestamptz not null default now(),
  issued_by        uuid default auth.uid(),
  business_date    date not null,
  net_total        numeric(20,4) not null,
  tax_total        numeric(20,4) not null,
  gross_total      numeric(20,4) not null,
  payments_total   numeric(20,4) not null,
  balance          numeric(20,4) not null,
  tax_split        jsonb not null default '[]'::jsonb,
  lines            jsonb not null default '[]'::jsonb,
  header           jsonb not null default '{}'::jsonb,
  idempotency_key  text not null,
  unique (property_id, number),
  unique (tenant_id, idempotency_key)
);
create index invoices_folio_idx on public.invoices(folio_id, issued_at desc);
grant select on public.invoices to authenticated;
grant all on public.invoices to service_role;
alter table public.invoices enable row level security;
create policy "Folio viewers read invoices" on public.invoices for select to authenticated
  using (tenant_id = app.my_tenant() and app.can('fin.folio.view', property_id));
create trigger invoices_immutable before update or delete on public.invoices
  for each row execute function app.block_ledger_change();

create or replace function public.issue_invoice(p_folio_id uuid, p_kind text, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.folios; r public.reservations; p public.properties; v_id uuid; v_bdate date;
  v_net numeric; v_tax numeric; v_pay numeric; v_split jsonb; v_lines jsonb; v_header jsonb;
begin
  perform app.assert_writable(true);
  if coalesce(btrim(p_idempotency_key), '') = '' then perform app.fail('E_REQUIRED', 'An idempotency key is required.'); end if;
  select id into v_id from public.invoices where tenant_id = app.my_tenant() and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;
  select * into f from public.folios where id = p_folio_id and tenant_id = app.my_tenant();
  if f.id is null or not app.can('fin.folio.view', f.property_id) then perform app.fail('E_NOT_FOUND', 'Folio not found.'); end if;
  perform app.require('fin.invoice.issue', f.property_id);
  if p_kind not in ('interim', 'final') then perform app.fail('E_INVALID', 'Choose interim or final.'); end if;
  if p_kind = 'final' and f.status <> 'closed' then
    perform app.fail('E_INVALID', 'A final invoice needs a closed folio. Issue an interim invoice instead.'); end if;
  select * into r from public.reservations where id = f.reservation_id;
  select * into p from public.properties where id = f.property_id;
  v_bdate := p.business_date;

  select coalesce(sum(t.base_amount) filter (where t.kind not in ('payment', 'refund')
           and not (t.kind in ('reversal', 'transfer') and t.payment_method_id is not null)), 0),
         coalesce(sum(t.base_amount) filter (where t.kind in ('payment', 'refund')
           or (t.kind in ('reversal', 'transfer') and t.payment_method_id is not null)), 0)
    into v_net, v_pay
  from public.folio_transactions t where t.folio_id = f.id;

  select coalesce(sum(x.amount), 0), coalesce(jsonb_agg(to_jsonb(x) order by x.line_no), '[]'::jsonb)
    into v_tax, v_split
  from (select min(l2.line_no) as line_no, l2.tax_code, max(l2.tax_name) as tax_name, l2.percent,
          sum(l2.taxable_base) as taxable_base, sum(l2.base_amount) as amount
        from public.folio_tax_lines l2 join public.folio_transactions t2 on t2.id = l2.transaction_id
        where t2.folio_id = f.id group by l2.tax_code, l2.percent) x;

  select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'date', v.business_date, 'kind', v.kind,
      'description', coalesce(v.description, v.charge_code_name, v.payment_method_name, v.kind),
      'net', v.base_amount, 'tax', v.tax_amount, 'total', v.total, 'tax_lines', coalesce(v.tax_lines, '[]'::jsonb),
      'is_reversed', v.is_reversed, 'is_transferred', v.is_transferred) order by v.posted_at), '[]'::jsonb)
    into v_lines
  from public.v_folio_transactions v where v.folio_id = f.id;

  select jsonb_build_object(
    'hotel', (select name from public.tenants where id = f.tenant_id), 'property', p.name, 'address', p.address, 'city', p.city,
    'country', p.country, 'folio_number', f.number, 'folio_label', f.label, 'reservation_number', r.number,
    'guest_name', (select nullif(btrim(coalesce(g.first_name, '') || ' ' || coalesce(g.last_name, '')), '') from public.guests g where g.id = f.guest_id),
    'company_name', r.company_name, 'arrival_date', r.arrival_date, 'departure_date', r.departure_date,
    'room_number', (select rm.room_number from public.stays s join public.rooms rm on rm.id = s.room_id
                    where s.reservation_id = r.id and s.status in ('in_house', 'checked_out') order by s.checked_in_at desc limit 1))
    into v_header;

  begin
    insert into public.invoices(tenant_id, property_id, folio_id, number, kind, currency, business_date, net_total, tax_total,
      gross_total, payments_total, balance, tax_split, lines, header, idempotency_key)
    values (f.tenant_id, f.property_id, f.id, app.next_document_number(f.property_id, 'invoice'), p_kind, f.currency, v_bdate,
      v_net, v_tax, v_net + v_tax, -v_pay, v_net + v_tax + v_pay, v_split, v_lines, v_header, p_idempotency_key)
    returning id into v_id;
  exception when unique_violation then
    select id into v_id from public.invoices where tenant_id = f.tenant_id and idempotency_key = p_idempotency_key;
  end;
  return v_id;
end $$;

create or replace function public.post_room_charges(p_property_id uuid, p_business_date date default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.properties; v_date date; cc public.charge_codes; s record; v_key text; v_id uuid; v_folio uuid;
  v_posted int := 0; v_skipped int := 0; l record;
begin
  perform app.assert_writable();
  perform app.require('fin.nightaudit.run', p_property_id);
  select * into p from public.properties where id = p_property_id and tenant_id = app.my_tenant();
  if p.id is null then perform app.fail('E_NOT_FOUND', 'Property not found.'); end if;
  v_date := coalesce(p_business_date, p.business_date);
  if v_date > p.business_date then perform app.fail('E_INVALID', 'Room charges cannot be posted for a future date.'); end if;
  select * into cc from public.charge_codes where property_id = p.id and category = 'room' and is_active order by (code = 'ROOM') desc, code limit 1;
  if cc.id is null then perform app.fail('E_INVALID', 'Add an active room charge code in Setup first.'); end if;

  create temp table if not exists _room_tax (line_no int, tax_code text, tax_name text, percent numeric, taxable_base numeric, amount numeric) on commit drop;

  for s in
    select st.reservation_id, n.rate_amount, rm.room_number, r.number
    from public.stays st
    join public.reservations r on r.id = st.reservation_id
    join public.reservation_nights n on n.reservation_id = r.id and n.stay_date = v_date
    join public.rooms rm on rm.id = st.room_id
    where st.property_id = p.id and st.status = 'in_house'
  loop
    v_key := 'room:' || s.reservation_id || ':' || v_date;
    if exists (select 1 from public.folio_transactions where tenant_id = p.tenant_id and idempotency_key = v_key) then
      v_skipped := v_skipped + 1; continue;
    end if;
    v_folio := app.ensure_main_folio(s.reservation_id);
    if (select status from public.folios where id = v_folio) <> 'open' or round(s.rate_amount, 2) <= 0 then
      v_skipped := v_skipped + 1; continue;
    end if;
    delete from _room_tax;
    if cc.is_taxable then insert into _room_tax select * from public.calculate_tax(p.id, round(s.rate_amount, 2), false); end if;
    begin
      insert into public.folio_transactions(tenant_id, property_id, folio_id, kind, charge_code_id, amount, currency, fx_rate,
        base_amount, tax_inclusive, description, reference, idempotency_key, business_date)
      values (p.tenant_id, p.id, v_folio, 'charge', cc.id, round(s.rate_amount, 2), p.base_currency, 1, round(s.rate_amount, 2), false,
        'Room ' || s.room_number || ' · ' || to_char(v_date, 'DD Mon YYYY'), s.number, v_key, v_date)
      returning id into v_id;
    exception when unique_violation then
      v_skipped := v_skipped + 1; continue;
    end;
    for l in select * from _room_tax order by line_no loop
      insert into public.folio_tax_lines(tenant_id, property_id, transaction_id, line_no, tax_code, tax_name, percent, taxable_base, amount, base_amount)
      values (p.tenant_id, p.id, v_id, l.line_no, l.tax_code, l.tax_name, l.percent, l.taxable_base, l.amount, l.amount);
    end loop;
    v_posted := v_posted + 1;
  end loop;
  return jsonb_build_object('business_date', v_date, 'posted', v_posted, 'skipped', v_skipped);
end $$;

create or replace view public.v_checkouts with (security_invoker = true) as
select s.id as stay_id, s.reservation_id, r.property_id, r.number, s.status, rm.room_number,
  nullif(btrim(coalesce(g.first_name, '') || ' ' || coalesce(g.last_name, '')), '') as guest_name,
  r.arrival_date, r.departure_date, r.status as reservation_status, s.checked_out_at, s.checkout_business_date,
  s.checkout_reason, r.currency,
  s.status = 'checked_out' and s.checkout_business_date = p.business_date as can_undo
from public.stays s
join public.reservations r on r.id = s.reservation_id
join public.properties p on p.id = s.property_id
join public.rooms rm on rm.id = s.room_id
left join public.guests g on g.id = r.guest_id
where s.status in ('in_house', 'checked_out');
grant select on public.v_checkouts to authenticated, service_role;

revoke all on function app.reservation_outstanding(uuid) from public;
revoke all on function
  public.request_unsettled_checkout(uuid, text, text), public.check_out(uuid, uuid, text), public.undo_checkout(uuid, text),
  public.issue_invoice(uuid, text, text), public.post_room_charges(uuid, date)
from public, anon;
grant execute on function
  public.request_unsettled_checkout(uuid, text, text), public.check_out(uuid, uuid, text), public.undo_checkout(uuid, text),
  public.issue_invoice(uuid, text, text), public.post_room_charges(uuid, date)
to authenticated, service_role;
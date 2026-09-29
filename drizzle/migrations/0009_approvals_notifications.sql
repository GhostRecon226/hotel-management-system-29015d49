-- Approvals, controlled money actions (discount, adjustment, reversal, refund) and notifications.

insert into public.permissions(key, description, module) values
  ('fin.reverse.approve', 'Approve reversals', 'finance')
on conflict (key) do nothing;
insert into public.role_permissions(role_id, permission_key, grant_level)
select r.id, 'fin.reverse.approve', 'Y' from public.roles r
where r.tenant_id is null and r.code in ('SYSADMIN', 'GM', 'ACCT')
on conflict do nothing;

-- Notifications ------------------------------------------------------
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  property_id  uuid references public.properties(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  kind         text not null,
  title        text not null,
  body         text,
  link         text,
  entity_id    uuid,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, read_at, created_at desc);
grant select on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "Users read own notifications" on public.notifications for select to authenticated
  using (user_id = auth.uid() and tenant_id = app.my_tenant());

create or replace function public.mark_notification_read(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.notifications set read_at = now() where id = p_id and user_id = auth.uid() and read_at is null;
end $$;
create or replace function public.mark_all_notifications_read()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
end $$;

-- Approvals ----------------------------------------------------------
create table public.approvals (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants(id) on delete cascade,
  property_id            uuid not null references public.properties(id) on delete cascade,
  kind                   text not null check (kind in ('discount', 'adjustment', 'reversal', 'refund')),
  entity                 text not null default 'folio',
  folio_id               uuid not null references public.folios(id),
  transaction_id         uuid references public.folio_transactions(id),
  payload                jsonb not null default '{}'::jsonb,
  amount                 numeric(20,4) not null,
  currency               character(3) not null,
  reason                 text not null,
  status                 text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  requested_by           uuid not null default auth.uid(),
  requested_at           timestamptz not null default now(),
  decided_by             uuid,
  decided_at             timestamptz,
  decision_reason        text,
  posted_transaction_id  uuid references public.folio_transactions(id),
  idempotency_key        text not null,
  unique (tenant_id, idempotency_key),
  constraint approvals_sod check (decided_by is null or decided_by <> requested_by)
);
create index approvals_property_status_idx on public.approvals(property_id, status, requested_at desc);
create unique index approvals_one_pending_reversal on public.approvals(transaction_id) where status = 'pending' and kind = 'reversal';

grant select on public.approvals to authenticated;
grant all on public.approvals to service_role;
alter table public.approvals enable row level security;
create policy "Folio viewers and requesters read approvals" on public.approvals for select to authenticated
  using (tenant_id = app.my_tenant() and (requested_by = auth.uid() or app.can('fin.folio.view', property_id)));
create trigger audit_approvals after insert or update or delete on public.approvals
  for each row execute function app.audit_row();

create or replace function app.approve_perm(p_kind text)
returns text language sql immutable as $$
  select case p_kind when 'discount' then 'fin.discount.approve' when 'adjustment' then 'fin.adjust.approve'
    when 'reversal' then 'fin.reverse.approve' when 'refund' then 'fin.refund.approve' end
$$;

create or replace function app.notify_approvers(a public.approvals)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.notifications(tenant_id, property_id, user_id, kind, title, body, link, entity_id)
  select distinct a.tenant_id, a.property_id, upr.user_id, 'approval_requested',
    'Approval needed: ' || a.kind,
    coalesce(p.full_name, 'Someone') || ' asked to approve a ' || a.kind || ' of ' || a.currency || ' ' || to_char(abs(a.amount), 'FM999,999,999,990.00') || '. ' || a.reason,
    '/approvals', a.id
  from public.user_property_roles upr
  join public.role_permissions rp on rp.role_id = upr.role_id and rp.permission_key = app.approve_perm(a.kind)
  left join public.profiles p on p.id = a.requested_by
  where upr.property_id = a.property_id and upr.tenant_id = a.tenant_id and upr.user_id <> a.requested_by
$$;

-- Total of a row including its tax lines.
create or replace function app.tx_total(p_id uuid)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select t.base_amount + coalesce((select sum(base_amount) from public.folio_tax_lines where transaction_id = t.id), 0)
  from public.folio_transactions t where t.id = p_id
$$;

-- Checks a row can be reversed: charges, payments, discounts, adjustments, refunds and rows moved in.
create or replace function app.assert_reversible(t public.folio_transactions)
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_orig public.folio_transactions;
begin
  select * into v_orig from public.folio_transactions where id = t.original_id;
  if not (t.kind in ('charge', 'payment', 'discount', 'adjustment', 'refund')
          or (t.kind = 'transfer' and v_orig.id is not null and v_orig.folio_id <> t.folio_id)) then
    perform app.fail('E_INVALID', 'This row cannot be reversed.'); end if;
  if exists (select 1 from public.folio_transactions x where x.original_id = t.id and x.kind in ('reversal', 'transfer')) then
    perform app.fail('E_ALREADY_REVERSED', 'This row has already been reversed or transferred.'); end if;
  if exists (select 1 from public.folio_transactions d where d.original_id = t.id and d.kind = 'discount'
             and not exists (select 1 from public.folio_transactions x where x.original_id = d.id and x.kind = 'reversal')) then
    perform app.fail('E_INVALID', 'This charge has a discount. Reverse the discount first.'); end if;
end $$;

create or replace function app.post_reversal(t public.folio_transactions, p_reason text, p_key text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.folios;
begin
  select * into f from public.folios where id = t.folio_id for update;
  if f.status <> 'open' then perform app.fail('E_FOLIO_CLOSED', 'Folio ' || f.number || ' is closed. Reopen it first.'); end if;
  perform app.assert_reversible(t);
  begin
    return app.post_mirror(t, 'reversal', t.folio_id, -1, t.id, p_key, 'Reversal: ' || btrim(p_reason));
  exception when unique_violation then
    perform app.fail('E_ALREADY_REVERSED', 'This row has already been reversed or transferred.');
  end;
end $$;

-- Discount on a charge: splits the discount across net and tax lines in proportion.
create or replace function app.discount_room(p_charge uuid)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select app.tx_total(p_charge) + coalesce((select sum(app.tx_total(d.id)) from public.folio_transactions d
    where d.original_id = p_charge and d.kind = 'discount'), 0)
    + coalesce((select sum(app.tx_total(x.id)) from public.folio_transactions d
      join public.folio_transactions x on x.original_id = d.id and x.kind = 'reversal'
      where d.original_id = p_charge and d.kind = 'discount'), 0)
$$;

create or replace function app.post_discount(c public.folio_transactions, p_amount numeric, p_reason text, p_key text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.folios; v_total numeric; v_ratio numeric; v_id uuid; v_taxsum numeric := 0; l record; v_part numeric;
begin
  select * into f from public.folios where id = c.folio_id for update;
  if f.status <> 'open' then perform app.fail('E_FOLIO_CLOSED', 'Folio ' || f.number || ' is closed. Reopen it first.'); end if;
  if c.kind <> 'charge' then perform app.fail('E_INVALID', 'Discounts can only be given on charges.'); end if;
  if exists (select 1 from public.folio_transactions x where x.original_id = c.id and x.kind in ('reversal', 'transfer')) then
    perform app.fail('E_INVALID', 'This charge has been reversed or moved.'); end if;
  if p_amount > app.discount_room(c.id) then
    perform app.fail('E_INVALID', 'The discount is more than what is left on this charge.'); end if;
  v_total := app.tx_total(c.id);
  v_ratio := p_amount / v_total;
  insert into public.folio_transactions(tenant_id, property_id, folio_id, kind, charge_code_id, amount, currency, fx_rate,
    base_amount, description, original_id, idempotency_key, business_date)
  values (c.tenant_id, c.property_id, c.folio_id, 'discount', c.charge_code_id, 0, c.currency, 1, 0,
    'Discount on ' || coalesce(c.description, 'charge') || ': ' || btrim(p_reason), c.id, p_key,
    (select business_date from public.properties where id = c.property_id))
  returning id into v_id;
  for l in select * from public.folio_tax_lines where transaction_id = c.id order by line_no loop
    v_part := -round(l.base_amount * v_ratio, 2);
    v_taxsum := v_taxsum + v_part;
    insert into public.folio_tax_lines(tenant_id, property_id, transaction_id, line_no, tax_code, tax_name, percent, taxable_base, amount, base_amount)
    values (l.tenant_id, l.property_id, v_id, l.line_no, l.tax_code, l.tax_name, l.percent, -round(l.taxable_base * v_ratio, 2), v_part, v_part);
  end loop;
  return v_id;
end $$;

-- The discount row is inserted with 0 first so tax lines can link to it; this is the only place a
-- transaction is finalised, done before commit by a deferred-free re-insert pattern is not possible, so
-- instead we compute the net part up front. (Replaced below with a single-insert version.)
create or replace function app.post_discount(c public.folio_transactions, p_amount numeric, p_reason text, p_key text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.folios; v_total numeric; v_ratio numeric; v_id uuid; v_taxsum numeric := 0; l record; v_net numeric;
begin
  select * into f from public.folios where id = c.folio_id for update;
  if f.status <> 'open' then perform app.fail('E_FOLIO_CLOSED', 'Folio ' || f.number || ' is closed. Reopen it first.'); end if;
  if c.kind <> 'charge' then perform app.fail('E_INVALID', 'Discounts can only be given on charges.'); end if;
  if exists (select 1 from public.folio_transactions x where x.original_id = c.id and x.kind in ('reversal', 'transfer')) then
    perform app.fail('E_INVALID', 'This charge has been reversed or moved.'); end if;
  if p_amount <= 0 or p_amount > app.discount_room(c.id) then
    perform app.fail('E_INVALID', 'The discount must be more than zero and no more than what is left on this charge.'); end if;
  v_total := app.tx_total(c.id);
  v_ratio := p_amount / v_total;
  select coalesce(sum(-round(base_amount * v_ratio, 2)), 0) into v_taxsum from public.folio_tax_lines where transaction_id = c.id;
  v_net := -round(p_amount, 2) - v_taxsum;
  insert into public.folio_transactions(tenant_id, property_id, folio_id, kind, charge_code_id, amount, currency, fx_rate,
    base_amount, description, original_id, idempotency_key, business_date)
  values (c.tenant_id, c.property_id, c.folio_id, 'discount', c.charge_code_id, v_net, c.currency, 1, v_net,
    'Discount on ' || coalesce(c.description, 'charge') || ': ' || btrim(p_reason), c.id, p_key,
    (select business_date from public.properties where id = c.property_id))
  returning id into v_id;
  for l in select * from public.folio_tax_lines where transaction_id = c.id order by line_no loop
    insert into public.folio_tax_lines(tenant_id, property_id, transaction_id, line_no, tax_code, tax_name, percent, taxable_base, amount, base_amount)
    values (l.tenant_id, l.property_id, v_id, l.line_no, l.tax_code, l.tax_name, l.percent,
      -round(l.taxable_base * v_ratio, 2), -round(l.base_amount * v_ratio, 2), -round(l.base_amount * v_ratio, 2));
  end loop;
  return v_id;
end $$;

create or replace function app.post_adjustment(a public.approvals, p_key text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.folios; v_id uuid;
begin
  select * into f from public.folios where id = a.folio_id for update;
  if f.status <> 'open' then perform app.fail('E_FOLIO_CLOSED', 'Folio ' || f.number || ' is closed. Reopen it first.'); end if;
  insert into public.folio_transactions(tenant_id, property_id, folio_id, kind, charge_code_id, amount, currency, fx_rate,
    base_amount, description, idempotency_key, business_date)
  values (a.tenant_id, a.property_id, a.folio_id, 'adjustment', nullif(a.payload->>'charge_code_id', '')::uuid, a.amount, f.currency, 1,
    a.amount, 'Adjustment: ' || a.reason, p_key, (select business_date from public.properties where id = a.property_id))
  returning id into v_id;
  return v_id;
end $$;

create or replace function app.post_refund(a public.approvals, p_key text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.folios; v_id uuid; v_rate numeric; v_date date; v_base numeric;
begin
  select * into f from public.folios where id = a.folio_id for update;
  if f.status <> 'open' then perform app.fail('E_FOLIO_CLOSED', 'Folio ' || f.number || ' is closed. Reopen it first.'); end if;
  select business_date into v_date from public.properties where id = a.property_id;
  v_rate := app.fx_rate(a.property_id, a.currency, v_date);
  v_base := round(a.amount * v_rate, 2);
  if v_base > -app.folio_balance(f.id) then
    perform app.fail('E_INVALID', 'The refund is more than the credit on this folio.'); end if;
  insert into public.folio_transactions(tenant_id, property_id, folio_id, kind, payment_method_id, amount, currency, fx_rate,
    base_amount, description, reference, idempotency_key, business_date)
  values (a.tenant_id, a.property_id, a.folio_id, 'refund', (a.payload->>'payment_method_id')::uuid, a.amount, a.currency, v_rate,
    v_base, 'Refund: ' || a.reason, nullif(a.payload->>'reference', ''), p_key, v_date)
  returning id into v_id;
  return v_id;
end $$;

create or replace function app.new_approval(f public.folios, p_kind text, p_tx uuid, p_payload jsonb, p_amount numeric,
  p_currency text, p_reason text, p_key text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.approvals;
begin
  insert into public.approvals(tenant_id, property_id, kind, folio_id, transaction_id, payload, amount, currency, reason, idempotency_key)
  values (f.tenant_id, f.property_id, p_kind, f.id, p_tx, coalesce(p_payload, '{}'::jsonb), p_amount, upper(p_currency), btrim(p_reason), p_key)
  returning * into a;
  perform app.notify_approvers(a);
  return a.id;
end $$;

create or replace function app.request_prelude(p_reason text, p_key text)
returns uuid language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if coalesce(btrim(p_key), '') = '' then perform app.fail('E_REQUIRED', 'An idempotency key is required.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  return (select id from public.approvals where tenant_id = app.my_tenant() and idempotency_key = p_key);
end $$;

-- Public request functions. Each returns jsonb {status, approval_id, transaction_id}.
create or replace function public.apply_discount(p_transaction_id uuid, p_amount numeric, p_reason text, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.folio_transactions; f public.folios; v_limit numeric; v_id uuid; v_tx uuid;
begin
  perform app.assert_writable();
  v_id := app.request_prelude(p_reason, p_idempotency_key);
  if v_id is not null then return jsonb_build_object('status', 'pending', 'approval_id', v_id); end if;
  v_tx := app.existing_tx(p_idempotency_key);
  if v_tx is not null then return jsonb_build_object('status', 'posted', 'transaction_id', v_tx); end if;
  select * into c from public.folio_transactions where id = p_transaction_id and tenant_id = app.my_tenant();
  if c.id is null then perform app.fail('E_NOT_FOUND', 'Charge not found.'); end if;
  f := app.folio_for_write(c.folio_id, 'fin.discount.apply');
  p_amount := round(coalesce(p_amount, 0), 2);
  if p_amount <= 0 or p_amount > app.discount_room(c.id) then
    perform app.fail('E_INVALID', 'The discount must be more than zero and no more than what is left on this charge.'); end if;
  v_limit := app.approval_limit('fin.discount.apply', f.property_id);
  if v_limit is null or p_amount <= v_limit then
    v_tx := app.post_discount(c, p_amount, p_reason, p_idempotency_key);
    return jsonb_build_object('status', 'posted', 'transaction_id', v_tx);
  end if;
  v_id := app.new_approval(f, 'discount', c.id, '{}'::jsonb, p_amount, f.currency, p_reason, p_idempotency_key);
  return jsonb_build_object('status', 'pending', 'approval_id', v_id);
end $$;

create or replace function public.request_adjustment(p_folio_id uuid, p_charge_code_id uuid, p_amount numeric, p_reason text, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.folios; v_id uuid;
begin
  perform app.assert_writable();
  v_id := app.request_prelude(p_reason, p_idempotency_key);
  if v_id is not null then return jsonb_build_object('status', 'pending', 'approval_id', v_id); end if;
  f := app.folio_for_write(p_folio_id, 'fin.adjust.post');
  p_amount := round(coalesce(p_amount, 0), 2);
  if p_amount = 0 then perform app.fail('E_INVALID', 'Amount cannot be zero.'); end if;
  if p_charge_code_id is not null and not exists (select 1 from public.charge_codes where id = p_charge_code_id and property_id = f.property_id) then
    perform app.fail('E_INVALID', 'Charge code not found.'); end if;
  v_id := app.new_approval(f, 'adjustment', null, jsonb_build_object('charge_code_id', p_charge_code_id), p_amount, f.currency, p_reason, p_idempotency_key);
  return jsonb_build_object('status', 'pending', 'approval_id', v_id);
end $$;

create or replace function public.request_reversal(p_transaction_id uuid, p_reason text, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.folio_transactions; f public.folios; v_id uuid;
begin
  v_id := app.request_prelude(p_reason, p_idempotency_key);
  if v_id is not null then return jsonb_build_object('status', 'pending', 'approval_id', v_id); end if;
  select * into t from public.folio_transactions where id = p_transaction_id and tenant_id = app.my_tenant();
  if t.id is null then perform app.fail('E_NOT_FOUND', 'Transaction not found.'); end if;
  perform app.assert_writable(t.kind = 'payment');
  f := app.folio_for_write(t.folio_id, 'fin.reverse.post');
  perform app.assert_reversible(t);
  begin
    v_id := app.new_approval(f, 'reversal', t.id, '{}'::jsonb, -app.tx_total(t.id), f.currency, p_reason, p_idempotency_key);
  exception when unique_violation then
    perform app.fail('E_INVALID', 'A reversal of this row is already waiting for approval.');
  end;
  return jsonb_build_object('status', 'pending', 'approval_id', v_id);
end $$;

create or replace function public.request_refund(p_folio_id uuid, p_payment_method_id uuid, p_amount numeric, p_currency text,
  p_reference text, p_reason text, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.folios; v_id uuid; v_cur text; v_rate numeric;
begin
  perform app.assert_writable(true);
  v_id := app.request_prelude(p_reason, p_idempotency_key);
  if v_id is not null then return jsonb_build_object('status', 'pending', 'approval_id', v_id); end if;
  f := app.folio_for_write(p_folio_id, 'fin.refund.post');
  if not exists (select 1 from public.payment_methods where id = p_payment_method_id and property_id = f.property_id and is_active) then
    perform app.fail('E_INVALID', 'Choose how the money is returned.'); end if;
  p_amount := round(coalesce(p_amount, 0), 2);
  if p_amount <= 0 then perform app.fail('E_INVALID', 'Amount must be more than zero.'); end if;
  v_cur := upper(coalesce(nullif(btrim(p_currency), ''), f.currency));
  v_rate := app.fx_rate(f.property_id, v_cur, (select business_date from public.properties where id = f.property_id));
  if round(p_amount * v_rate, 2) > -app.folio_balance(f.id) then
    perform app.fail('E_INVALID', 'The refund is more than the credit on this folio.'); end if;
  v_id := app.new_approval(f, 'refund', null,
    jsonb_build_object('payment_method_id', p_payment_method_id, 'reference', nullif(btrim(p_reference), '')),
    p_amount, v_cur, p_reason, p_idempotency_key);
  return jsonb_build_object('status', 'pending', 'approval_id', v_id);
end $$;

create or replace function public.decide_approval(p_id uuid, p_approve boolean, p_reason text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.approvals; v_perm text; v_limit numeric; v_tx uuid; t public.folio_transactions; c public.folio_transactions;
begin
  select * into a from public.approvals where id = p_id and tenant_id = app.my_tenant() for update;
  if a.id is null then perform app.fail('E_NOT_FOUND', 'Request not found.'); end if;
  perform app.assert_writable(a.kind = 'refund' or not p_approve);
  if a.status <> 'pending' then perform app.fail('E_INVALID', 'This request has already been decided or withdrawn.'); end if;
  if a.requested_by = auth.uid() then
    perform app.fail('E_SOD', 'You cannot approve or reject your own request. Another approver must decide it.'); end if;
  v_perm := app.approve_perm(a.kind);
  perform app.require(v_perm, a.property_id);
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;

  if p_approve then
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
    initcap(a.kind) || case when p_approve then ' approved' else ' rejected' end,
    btrim(p_reason), '/approvals', a.id);
  return v_tx;
end $$;

create or replace function public.withdraw_approval(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.approvals;
begin
  select * into a from public.approvals where id = p_id and tenant_id = app.my_tenant() for update;
  if a.id is null then perform app.fail('E_NOT_FOUND', 'Request not found.'); end if;
  if a.requested_by <> auth.uid() then perform app.fail('E_FORBIDDEN', 'Only the person who asked can withdraw a request.'); end if;
  if a.status <> 'pending' then perform app.fail('E_INVALID', 'Only pending requests can be withdrawn.'); end if;
  update public.approvals set status = 'withdrawn', decided_at = now() where id = a.id;
  update public.notifications set read_at = coalesce(read_at, now()) where entity_id = a.id and kind = 'approval_requested';
end $$;

-- Direct reversal is no longer allowed: reversals go through approval.
revoke execute on function public.reverse_transaction(uuid, text, text) from authenticated;

-- Transfers must not strand a discount on the old folio.
create or replace function app.do_transfer(p_id uuid, p_to uuid, p_key text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.folio_transactions; src public.folios; dst public.folios; v_out uuid; v_in uuid; v_orig_kind text;
begin
  select * into t from public.folio_transactions where id = p_id and tenant_id = app.my_tenant();
  if t.id is null then perform app.fail('E_NOT_FOUND', 'Transaction not found.'); end if;
  if t.folio_id = p_to then perform app.fail('E_INVALID', 'Choose a different folio.'); end if;
  if t.folio_id < p_to then
    src := app.folio_for_write(t.folio_id, 'fin.charge.post'); dst := app.folio_for_write(p_to, 'fin.charge.post');
  else
    dst := app.folio_for_write(p_to, 'fin.charge.post'); src := app.folio_for_write(t.folio_id, 'fin.charge.post');
  end if;
  if src.reservation_id <> dst.reservation_id then perform app.fail('E_INVALID', 'Transfers are only allowed between folios of the same stay.'); end if;
  select kind into v_orig_kind from public.folio_transactions where id = t.original_id;
  if not (t.kind in ('charge', 'payment') or (t.kind = 'transfer' and v_orig_kind = 'transfer')) then
    perform app.fail('E_INVALID', 'This row cannot be transferred.'); end if;
  if exists (select 1 from public.folio_transactions x where x.original_id = t.id and x.kind in ('reversal', 'transfer')) then
    perform app.fail('E_ALREADY_REVERSED', 'This row has already been reversed or transferred.'); end if;
  if exists (select 1 from public.folio_transactions d where d.original_id = t.id and d.kind = 'discount') then
    perform app.fail('E_INVALID', 'Charges with a discount cannot be moved.'); end if;
  begin
    v_out := app.post_mirror(t, 'transfer', src.id, -1, t.id, p_key, 'Moved to folio ' || dst.number || ': ' || coalesce(t.description, ''));
    select * into t from public.folio_transactions where id = p_id;
    v_in := app.post_mirror(t, 'transfer', dst.id, 1, v_out, p_key || ':in', 'Moved from folio ' || src.number || ': ' || coalesce(t.description, ''));
  exception when unique_violation then
    perform app.fail('E_ALREADY_REVERSED', 'This row has already been reversed or transferred.');
  end;
  return v_in;
end $$;

create view public.v_approvals with (security_invoker = true) as
select a.id, a.property_id, a.kind, a.folio_id, f.number as folio_number, f.reservation_id, a.transaction_id,
  t.description as transaction_description, a.amount, a.currency, a.reason, a.status,
  a.requested_by, rq.full_name as requested_by_name, a.requested_at,
  a.decided_by, dc.full_name as decided_by_name, a.decided_at, a.decision_reason, a.posted_transaction_id,
  nullif(btrim(coalesce(g.first_name, '') || ' ' || coalesce(g.last_name, '')), '') as guest_name
from public.approvals a
join public.folios f on f.id = a.folio_id
left join public.folio_transactions t on t.id = a.transaction_id
left join public.profiles rq on rq.id = a.requested_by
left join public.profiles dc on dc.id = a.decided_by
left join public.guests g on g.id = f.guest_id;
grant select on public.v_approvals to authenticated, service_role;

revoke all on function app.approve_perm(text), app.notify_approvers(public.approvals), app.tx_total(uuid),
  app.assert_reversible(public.folio_transactions), app.post_reversal(public.folio_transactions, text, text),
  app.discount_room(uuid), app.post_discount(public.folio_transactions, numeric, text, text),
  app.post_adjustment(public.approvals, text), app.post_refund(public.approvals, text),
  app.new_approval(public.folios, text, uuid, jsonb, numeric, text, text, text), app.request_prelude(text, text) from public;

revoke all on function
  public.mark_notification_read(uuid), public.mark_all_notifications_read(),
  public.apply_discount(uuid, numeric, text, text),
  public.request_adjustment(uuid, uuid, numeric, text, text),
  public.request_reversal(uuid, text, text),
  public.request_refund(uuid, uuid, numeric, text, text, text, text),
  public.decide_approval(uuid, boolean, text),
  public.withdraw_approval(uuid)
from public, anon;
grant execute on function
  public.mark_notification_read(uuid), public.mark_all_notifications_read(),
  public.apply_discount(uuid, numeric, text, text),
  public.request_adjustment(uuid, uuid, numeric, text, text),
  public.request_reversal(uuid, text, text),
  public.request_refund(uuid, uuid, numeric, text, text, text, text),
  public.decide_approval(uuid, boolean, text),
  public.withdraw_approval(uuid)
to authenticated, service_role;

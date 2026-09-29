-- Folios and the immutable ledger. Amounts are signed: charges positive, payments negative.
-- Balances are always computed (v_folio_balances), never stored.

insert into public.permissions(key, description, module) values
  ('fin.folio.reopen', 'Reopen a closed folio', 'finance')
on conflict (key) do nothing;
insert into public.role_permissions(role_id, permission_key, grant_level)
select r.id, 'fin.folio.reopen', 'Y' from public.roles r
where r.tenant_id is null and r.code in ('SYSADMIN', 'GM', 'FOM', 'ACCT')
on conflict do nothing;

create table public.folios (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  property_id      uuid not null references public.properties(id) on delete cascade,
  reservation_id   uuid not null references public.reservations(id),
  guest_id         uuid references public.guests(id),
  number           text not null,
  label            text not null default 'Main',
  is_main          boolean not null default false,
  status           text not null default 'open' check (status in ('open', 'closed')),
  currency         character(3) not null,
  idempotency_key  text,
  closed_at        timestamptz,
  closed_by        uuid,
  created_by       uuid default auth.uid(),
  created_at       timestamptz not null default now(),
  unique (property_id, number),
  unique (tenant_id, idempotency_key)
);
create unique index folios_one_main_per_res on public.folios(reservation_id) where is_main;
create index folios_reservation_idx on public.folios(reservation_id);
create index folios_property_status_idx on public.folios(property_id, status);

create table public.folio_transactions (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  property_id        uuid not null references public.properties(id) on delete cascade,
  folio_id           uuid not null references public.folios(id),
  kind               text not null check (kind in ('charge', 'payment', 'discount', 'adjustment', 'reversal', 'refund', 'transfer')),
  charge_code_id     uuid references public.charge_codes(id),
  payment_method_id  uuid references public.payment_methods(id),
  amount             numeric(20,4) not null,
  currency           character(3) not null,
  fx_rate            numeric(20,8) not null default 1 check (fx_rate > 0),
  base_amount        numeric(20,4) not null,
  tax_inclusive      boolean not null default false,
  is_deposit         boolean not null default false,
  description        text,
  reference          text,
  original_id        uuid references public.folio_transactions(id),
  idempotency_key    text not null,
  posted_by          uuid default auth.uid(),
  posted_at          timestamptz not null default now(),
  business_date      date not null,
  unique (tenant_id, idempotency_key)
);
-- A row can be reversed or transferred out once, never both.
create unique index folio_tx_one_link on public.folio_transactions(original_id) where kind in ('reversal', 'transfer');
create index folio_tx_folio_idx on public.folio_transactions(folio_id, posted_at);

create table public.folio_tax_lines (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  property_id     uuid not null references public.properties(id) on delete cascade,
  transaction_id  uuid not null references public.folio_transactions(id),
  line_no         integer not null,
  tax_code        text not null,
  tax_name        text not null,
  percent         numeric(9,4) not null,
  taxable_base    numeric(20,4) not null,
  amount          numeric(20,4) not null,
  base_amount     numeric(20,4) not null,
  unique (transaction_id, line_no)
);

grant select on public.folios, public.folio_transactions, public.folio_tax_lines to authenticated;
grant all on public.folios, public.folio_transactions, public.folio_tax_lines to service_role;
alter table public.folios enable row level security;
alter table public.folio_transactions enable row level security;
alter table public.folio_tax_lines enable row level security;
create policy "Folio viewers read folios" on public.folios for select to authenticated
  using (tenant_id = app.my_tenant() and app.can('fin.folio.view', property_id));
create policy "Folio viewers read transactions" on public.folio_transactions for select to authenticated
  using (tenant_id = app.my_tenant() and app.can('fin.folio.view', property_id));
create policy "Folio viewers read tax lines" on public.folio_tax_lines for select to authenticated
  using (tenant_id = app.my_tenant() and app.can('fin.folio.view', property_id));

-- Rule 1: posted rows are never changed or removed.
create or replace function app.block_ledger_change()
returns trigger language plpgsql as $$
begin
  perform app.fail('E_IMMUTABLE', 'Posted transactions cannot be changed or deleted. Post a reversal instead.');
  return null;
end $$;
create trigger folio_transactions_immutable before update or delete on public.folio_transactions
  for each row execute function app.block_ledger_change();
create trigger folio_tax_lines_immutable before update or delete on public.folio_tax_lines
  for each row execute function app.block_ledger_change();

create trigger audit_folios after insert or update or delete on public.folios
  for each row execute function app.audit_row();

-- Helpers -------------------------------------------------------------
create or replace function app.folio_balance(p_folio uuid)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select sum(base_amount) from public.folio_transactions where folio_id = p_folio), 0)
       + coalesce((select sum(l.base_amount) from public.folio_tax_lines l
                   join public.folio_transactions t on t.id = l.transaction_id where t.folio_id = p_folio), 0)
$$;

create or replace function app.folio_for_write(p_folio uuid, p_perm text)
returns public.folios language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.folios;
begin
  select * into f from public.folios where id = p_folio and tenant_id = app.my_tenant() for update;
  if f.id is null or not app.can('fin.folio.view', f.property_id) then perform app.fail('E_NOT_FOUND', 'Folio not found.'); end if;
  perform app.require(p_perm, f.property_id);
  if f.status <> 'open' then perform app.fail('E_FOLIO_CLOSED', 'Folio ' || f.number || ' is closed. Reopen it first.'); end if;
  return f;
end $$;

create or replace function app.existing_tx(p_key text)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select id from public.folio_transactions where tenant_id = app.my_tenant() and idempotency_key = p_key
$$;

create or replace function app.fx_rate(p_property uuid, p_currency text, p_date date)
returns numeric language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_base text; v_rate numeric;
begin
  select base_currency into v_base from public.properties where id = p_property;
  if upper(p_currency) = v_base then return 1; end if;
  select rate into v_rate from public.exchange_rates
   where property_id = p_property and currency = upper(p_currency) and rate_date <= p_date
   order by rate_date desc limit 1;
  if v_rate is null then
    perform app.fail('E_NO_RATE', 'No exchange rate for ' || upper(p_currency) || ' on or before ' || to_char(p_date, 'DD Mon YYYY') || '. Add one in Setup.');
  end if;
  return v_rate;
end $$;

-- Copies tax lines from one transaction to another, multiplied by p_sign.
create or replace function app.copy_tax_lines(p_from uuid, p_to uuid, p_sign integer)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.folio_tax_lines(tenant_id, property_id, transaction_id, line_no, tax_code, tax_name, percent, taxable_base, amount, base_amount)
  select tenant_id, property_id, p_to, line_no, tax_code, tax_name, percent, taxable_base * p_sign, amount * p_sign, base_amount * p_sign
  from public.folio_tax_lines where transaction_id = p_from
$$;

-- Inserts the opposite of a row (used for reversals and transfer-out rows).
create or replace function app.post_mirror(src public.folio_transactions, p_kind text, p_folio uuid, p_sign integer,
  p_original uuid, p_key text, p_description text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  insert into public.folio_transactions(tenant_id, property_id, folio_id, kind, charge_code_id, payment_method_id, amount, currency,
    fx_rate, base_amount, tax_inclusive, is_deposit, description, reference, original_id, idempotency_key, business_date)
  values (src.tenant_id, src.property_id, p_folio, p_kind, src.charge_code_id, src.payment_method_id, src.amount * p_sign, src.currency,
    src.fx_rate, src.base_amount * p_sign, src.tax_inclusive, src.is_deposit, p_description, src.reference, p_original, p_key,
    (select business_date from public.properties where id = src.property_id))
  returning id into v_id;
  perform app.copy_tax_lines(src.id, v_id, p_sign);
  return v_id;
end $$;

create or replace function app.ensure_main_folio(p_res uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; v_id uuid;
begin
  select id into v_id from public.folios where reservation_id = p_res and is_main;
  if v_id is not null then return v_id; end if;
  select * into r from public.reservations where id = p_res for update;
  select id into v_id from public.folios where reservation_id = p_res and is_main;
  if v_id is not null then return v_id; end if;
  insert into public.folios(tenant_id, property_id, reservation_id, guest_id, number, label, is_main, currency, created_by)
  values (r.tenant_id, r.property_id, r.id, r.guest_id, app.next_document_number(r.property_id, 'folio'), 'Main', true,
    (select base_currency from public.properties where id = r.property_id), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Rule 8: every stay gets a main folio.
create or replace function app.stays_main_folio()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.ensure_main_folio(new.reservation_id);
  return null;
end $$;
create trigger stays_main_folio after insert on public.stays
  for each row when (new.status = 'in_house') execute function app.stays_main_folio();

select app.ensure_main_folio(s.reservation_id) from public.stays s where s.status = 'in_house';

-- Deposit received = deposit payments across the booking's folios, net of reversals.
create or replace function app.deposit_paid(p_res uuid)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(-sum(t.base_amount), 0)
  from public.folio_transactions t join public.folios f on f.id = t.folio_id
  where f.reservation_id = p_res and t.is_deposit
$$;

-- Public functions ----------------------------------------------------
create or replace function public.open_main_folio(p_reservation_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; v_id uuid;
begin
  select * into r from public.reservations where id = p_reservation_id and tenant_id = app.my_tenant();
  if r.id is null or not app.can('fin.folio.view', r.property_id) then perform app.fail('E_NOT_FOUND', 'Reservation not found.'); end if;
  select id into v_id from public.folios where reservation_id = r.id and is_main;
  if v_id is not null then return v_id; end if;
  perform app.assert_writable(true);
  if not (app.can('fin.charge.post', r.property_id) or app.can('fin.payment.post', r.property_id)) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to open folios.'); end if;
  if r.status in ('cancelled', 'no_show') then perform app.fail('E_INVALID', 'This booking is not active.'); end if;
  return app.ensure_main_folio(r.id);
end $$;

create or replace function public.post_charge(p_folio_id uuid, p_charge_code_id uuid, p_amount numeric,
  p_tax_inclusive boolean, p_description text, p_reference text, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.folios; cc public.charge_codes; v_id uuid; v_tax numeric := 0; v_net numeric; l record;
begin
  perform app.assert_writable();
  if coalesce(btrim(p_idempotency_key), '') = '' then perform app.fail('E_REQUIRED', 'An idempotency key is required.'); end if;
  v_id := app.existing_tx(p_idempotency_key);
  if v_id is not null then return v_id; end if;
  f := app.folio_for_write(p_folio_id, 'fin.charge.post');
  select * into cc from public.charge_codes where id = p_charge_code_id and property_id = f.property_id and is_active;
  if cc.id is null then perform app.fail('E_INVALID', 'Choose a charge code.'); end if;
  if p_amount is null or p_amount <= 0 then perform app.fail('E_INVALID', 'Amount must be more than zero.'); end if;
  p_amount := round(p_amount, 2);

  create temp table if not exists _tax_lines (line_no int, tax_code text, tax_name text, percent numeric, taxable_base numeric, amount numeric) on commit drop;
  delete from _tax_lines;
  if cc.is_taxable then
    insert into _tax_lines select * from public.calculate_tax(f.property_id, p_amount, coalesce(p_tax_inclusive, false));
    select coalesce(sum(amount), 0) into v_tax from _tax_lines;
  end if;
  v_net := case when coalesce(p_tax_inclusive, false) then p_amount - v_tax else p_amount end;

  begin
    insert into public.folio_transactions(tenant_id, property_id, folio_id, kind, charge_code_id, amount, currency, fx_rate,
      base_amount, tax_inclusive, description, reference, idempotency_key, business_date)
    values (f.tenant_id, f.property_id, f.id, 'charge', cc.id, v_net, f.currency, 1, v_net, coalesce(p_tax_inclusive, false),
      coalesce(nullif(btrim(p_description), ''), cc.name), nullif(btrim(p_reference), ''), p_idempotency_key,
      (select business_date from public.properties where id = f.property_id))
    returning id into v_id;
  exception when unique_violation then
    return app.existing_tx(p_idempotency_key);
  end;
  for l in select * from _tax_lines order by line_no loop
    insert into public.folio_tax_lines(tenant_id, property_id, transaction_id, line_no, tax_code, tax_name, percent, taxable_base, amount, base_amount)
    values (f.tenant_id, f.property_id, v_id, l.line_no, l.tax_code, l.tax_name, l.percent, l.taxable_base, l.amount, l.amount);
  end loop;
  return v_id;
end $$;

create or replace function public.post_payment(p_folio_id uuid, p_payment_method_id uuid, p_amount numeric, p_currency text,
  p_is_deposit boolean, p_description text, p_reference text, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.folios; pm public.payment_methods; v_id uuid; v_rate numeric; v_cur text; v_date date;
begin
  perform app.assert_writable(true);
  if coalesce(btrim(p_idempotency_key), '') = '' then perform app.fail('E_REQUIRED', 'An idempotency key is required.'); end if;
  v_id := app.existing_tx(p_idempotency_key);
  if v_id is not null then return v_id; end if;
  f := app.folio_for_write(p_folio_id, 'fin.payment.post');
  select * into pm from public.payment_methods where id = p_payment_method_id and property_id = f.property_id and is_active;
  if pm.id is null then perform app.fail('E_INVALID', 'Choose a payment method.'); end if;
  if p_amount is null or p_amount <= 0 then perform app.fail('E_INVALID', 'Amount must be more than zero.'); end if;
  p_amount := round(p_amount, 2);
  v_cur := upper(coalesce(nullif(btrim(p_currency), ''), f.currency));
  select business_date into v_date from public.properties where id = f.property_id;
  v_rate := app.fx_rate(f.property_id, v_cur, v_date);
  begin
    insert into public.folio_transactions(tenant_id, property_id, folio_id, kind, payment_method_id, amount, currency, fx_rate,
      base_amount, is_deposit, description, reference, idempotency_key, business_date)
    values (f.tenant_id, f.property_id, f.id, 'payment', pm.id, -p_amount, v_cur, v_rate, -round(p_amount * v_rate, 2),
      coalesce(p_is_deposit, false), coalesce(nullif(btrim(p_description), ''), pm.name || ' payment'),
      nullif(btrim(p_reference), ''), p_idempotency_key, v_date)
    returning id into v_id;
  exception when unique_violation then
    return app.existing_tx(p_idempotency_key);
  end;
  return v_id;
end $$;

-- Rule 3: a reversal is a new opposite row linked to the original.
create or replace function public.reverse_transaction(p_id uuid, p_reason text, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.folio_transactions; f public.folios; v_id uuid; v_orig_kind text;
begin
  if coalesce(btrim(p_idempotency_key), '') = '' then perform app.fail('E_REQUIRED', 'An idempotency key is required.'); end if;
  v_id := app.existing_tx(p_idempotency_key);
  if v_id is not null then return v_id; end if;
  select * into t from public.folio_transactions where id = p_id and tenant_id = app.my_tenant();
  if t.id is null then perform app.fail('E_NOT_FOUND', 'Transaction not found.'); end if;
  perform app.assert_writable(t.kind = 'payment');
  f := app.folio_for_write(t.folio_id, 'fin.reverse.post');
  select kind into v_orig_kind from public.folio_transactions where id = t.original_id;
  if not (t.kind in ('charge', 'payment') or (t.kind = 'transfer' and v_orig_kind = 'transfer')) then
    perform app.fail('E_INVALID', 'This row cannot be reversed.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  if exists (select 1 from public.folio_transactions x where x.original_id = t.id and x.kind in ('reversal', 'transfer')) then
    perform app.fail('E_ALREADY_REVERSED', 'This row has already been reversed or transferred.'); end if;
  begin
    v_id := app.post_mirror(t, 'reversal', t.folio_id, -1, t.id, p_idempotency_key, 'Reversal: ' || btrim(p_reason));
  exception when unique_violation then
    perform app.fail('E_ALREADY_REVERSED', 'This row has already been reversed or transferred.');
  end;
  return v_id;
end $$;

-- Rule 8: transfer = linked pair. Out row (opposite, on the source) links to the original; in row links to the out row.
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
  begin
    v_out := app.post_mirror(t, 'transfer', src.id, -1, t.id, p_key, 'Moved to folio ' || dst.number || ': ' || coalesce(t.description, ''));
    select * into t from public.folio_transactions where id = p_id;
    v_in := app.post_mirror(t, 'transfer', dst.id, 1, v_out, p_key || ':in', 'Moved from folio ' || src.number || ': ' || coalesce(t.description, ''));
  exception when unique_violation then
    perform app.fail('E_ALREADY_REVERSED', 'This row has already been reversed or transferred.');
  end;
  return v_in;
end $$;

create or replace function public.transfer_transaction(p_id uuid, p_to_folio_id uuid, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  perform app.assert_writable(true);
  if coalesce(btrim(p_idempotency_key), '') = '' then perform app.fail('E_REQUIRED', 'An idempotency key is required.'); end if;
  select id into v_id from public.folio_transactions where tenant_id = app.my_tenant() and idempotency_key = p_idempotency_key || ':in';
  if v_id is not null then return v_id; end if;
  return app.do_transfer(p_id, p_to_folio_id, p_idempotency_key);
end $$;

-- Creates another folio on the same stay and optionally moves rows into it.
create or replace function public.split_folio(p_folio_id uuid, p_label text, p_guest_id uuid, p_transaction_ids uuid[], p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.folios; v_id uuid; v_tx uuid;
begin
  perform app.assert_writable(true);
  if coalesce(btrim(p_idempotency_key), '') = '' then perform app.fail('E_REQUIRED', 'An idempotency key is required.'); end if;
  select id into v_id from public.folios where tenant_id = app.my_tenant() and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;
  f := app.folio_for_write(p_folio_id, 'fin.charge.post');
  if coalesce(btrim(p_label), '') = '' then perform app.fail('E_REQUIRED', 'Give the new folio a name.'); end if;
  if p_guest_id is not null and not exists (select 1 from public.guests where id = p_guest_id and tenant_id = f.tenant_id) then
    perform app.fail('E_INVALID', 'Guest not found.'); end if;
  insert into public.folios(tenant_id, property_id, reservation_id, guest_id, number, label, is_main, currency, idempotency_key)
  values (f.tenant_id, f.property_id, f.reservation_id, coalesce(p_guest_id, f.guest_id),
    app.next_document_number(f.property_id, 'folio'), btrim(p_label), false, f.currency, p_idempotency_key)
  returning id into v_id;
  foreach v_tx in array coalesce(p_transaction_ids, '{}') loop
    if not exists (select 1 from public.folio_transactions where id = v_tx and folio_id = f.id) then
      perform app.fail('E_INVALID', 'Only rows from this folio can be moved.'); end if;
    perform app.do_transfer(v_tx, v_id, p_idempotency_key || ':' || v_tx::text);
  end loop;
  return v_id;
end $$;

-- Rule 7.
create or replace function public.close_folio(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.folios; v_bal numeric;
begin
  perform app.assert_writable(true);
  f := app.folio_for_write(p_id, 'fin.payment.post');
  v_bal := app.folio_balance(f.id);
  if v_bal <> 0 then
    perform app.fail('E_BALANCE_DUE', 'The folio must be settled to zero before closing. Balance: ' || to_char(v_bal, 'FM999,999,999,990.00') || '.');
  end if;
  update public.folios set status = 'closed', closed_at = now(), closed_by = auth.uid() where id = f.id;
end $$;

create or replace function public.reopen_folio(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.folios;
begin
  perform app.assert_writable();
  select * into f from public.folios where id = p_id and tenant_id = app.my_tenant() for update;
  if f.id is null or not app.can('fin.folio.view', f.property_id) then perform app.fail('E_NOT_FOUND', 'Folio not found.'); end if;
  perform app.require('fin.folio.reopen', f.property_id);
  if f.status <> 'closed' then perform app.fail('E_INVALID', 'The folio is already open.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required to reopen a folio.'); end if;
  perform set_config('app.audit_reason', btrim(p_reason), true);
  update public.folios set status = 'open', closed_at = null, closed_by = null where id = f.id;
  perform set_config('app.audit_reason', '', true);
end $$;

-- Merges must also move folios.
create or replace function public.merge_guests(p_keep uuid, p_remove uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid := app.my_tenant();
begin
  perform app.require_any('guest.merge');
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  if p_keep = p_remove then perform app.fail('E_INVALID', 'Choose two different guests.'); end if;
  perform 1 from public.guests where id in (p_keep, p_remove) and tenant_id = v_tenant for update;
  perform app.guest_for_write(p_keep);
  perform app.guest_for_write(p_remove);
  perform set_config('app.audit_reason', btrim(p_reason), true);

  update public.guest_documents set guest_id = p_keep where guest_id = p_remove;
  update public.guest_feedback set guest_id = p_keep where guest_id = p_remove;
  update public.reservations set guest_id = p_keep where guest_id = p_remove;
  delete from public.reservation_guests rg where rg.guest_id = p_remove
    and exists (select 1 from public.reservation_guests k where k.reservation_id = rg.reservation_id and k.guest_id = p_keep);
  update public.reservation_guests set guest_id = p_keep where guest_id = p_remove;
  update public.reservation_guests rg set is_primary = true from public.reservations r
    where r.id = rg.reservation_id and r.guest_id = p_keep and rg.guest_id = p_keep;
  update public.folios set guest_id = p_keep where guest_id = p_remove;
  update public.guests set status = 'merged', merged_into = p_keep, updated_at = now() where id = p_remove;

  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after, reason)
  values (v_tenant, auth.uid(), 'merge_guests', 'guests', p_keep::text,
          jsonb_build_object('kept', p_keep, 'removed', p_remove), btrim(p_reason));
  perform set_config('app.audit_reason', '', true);
end $$;

-- Views ---------------------------------------------------------------
create view public.v_folio_transactions with (security_invoker = true) as
select t.id, t.folio_id, t.property_id, t.kind, t.charge_code_id, cc.code as charge_code, cc.name as charge_code_name,
  t.payment_method_id, pm.name as payment_method_name, t.amount, t.currency, t.fx_rate, t.base_amount,
  coalesce(tx.tax, 0) as tax_amount, t.base_amount + coalesce(tx.tax, 0) as total,
  t.tax_inclusive, t.is_deposit, t.description, t.reference, t.original_id, t.posted_by, pr.full_name as posted_by_name,
  t.posted_at, t.business_date,
  exists (select 1 from public.folio_transactions x where x.original_id = t.id and x.kind = 'reversal') as is_reversed,
  exists (select 1 from public.folio_transactions x where x.original_id = t.id and x.kind = 'transfer') as is_transferred,
  (select jsonb_agg(jsonb_build_object('name', l.tax_name, 'percent', l.percent, 'amount', l.base_amount) order by l.line_no)
     from public.folio_tax_lines l where l.transaction_id = t.id) as tax_lines
from public.folio_transactions t
left join public.charge_codes cc on cc.id = t.charge_code_id
left join public.payment_methods pm on pm.id = t.payment_method_id
left join public.profiles pr on pr.id = t.posted_by
left join lateral (select sum(l.base_amount) as tax from public.folio_tax_lines l where l.transaction_id = t.id) tx on true;

create view public.v_folio_balances with (security_invoker = true) as
select f.id as folio_id, f.property_id, f.reservation_id, r.number as reservation_number, f.number, f.label, f.is_main, f.status,
  f.currency, f.guest_id, nullif(btrim(coalesce(g.first_name, '') || ' ' || coalesce(g.last_name, '')), '') as guest_name,
  r.arrival_date, r.departure_date, r.status as reservation_status, rm.room_number, f.closed_at, f.created_at,
  coalesce(sum(v.total) filter (where v.total > 0), 0) as total_debits,
  coalesce(-sum(v.total) filter (where v.total < 0), 0) as total_credits,
  coalesce(sum(v.total), 0) as balance
from public.folios f
join public.reservations r on r.id = f.reservation_id
left join public.guests g on g.id = f.guest_id
left join lateral (select s.room_id from public.stays s where s.reservation_id = r.id and s.status in ('in_house', 'checked_out')
  order by s.checked_in_at desc limit 1) st on true
left join public.rooms rm on rm.id = st.room_id
left join public.v_folio_transactions v on v.folio_id = f.id
group by f.id, r.number, g.first_name, g.last_name, r.arrival_date, r.departure_date, r.status, rm.room_number;

grant select on public.v_folio_transactions, public.v_folio_balances to authenticated, service_role;

revoke all on function app.folio_balance(uuid), app.folio_for_write(uuid, text), app.existing_tx(text), app.fx_rate(uuid, text, date),
  app.copy_tax_lines(uuid, uuid, integer), app.post_mirror(public.folio_transactions, text, uuid, integer, uuid, text, text),
  app.ensure_main_folio(uuid), app.do_transfer(uuid, uuid, text) from public;

revoke all on function
  public.open_main_folio(uuid),
  public.post_charge(uuid, uuid, numeric, boolean, text, text, text),
  public.post_payment(uuid, uuid, numeric, text, boolean, text, text, text),
  public.reverse_transaction(uuid, text, text),
  public.transfer_transaction(uuid, uuid, text),
  public.split_folio(uuid, text, uuid, uuid[], text),
  public.close_folio(uuid),
  public.reopen_folio(uuid, text)
from public, anon;
grant execute on function
  public.open_main_folio(uuid),
  public.post_charge(uuid, uuid, numeric, boolean, text, text, text),
  public.post_payment(uuid, uuid, numeric, text, boolean, text, text, text),
  public.reverse_transaction(uuid, text, text),
  public.transfer_transaction(uuid, uuid, text),
  public.split_folio(uuid, text, uuid, uuid[], text),
  public.close_folio(uuid),
  public.reopen_folio(uuid, text)
to authenticated, service_role;

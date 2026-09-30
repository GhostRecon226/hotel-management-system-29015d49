-- Money precision per currency (audit finding S6, requirement NFR-004).
--
-- Before: amounts with too many decimals were silently rounded (for example 100.123 naira became 100.12),
-- so what the cashier typed and what was posted could differ without anyone noticing.
-- After: an amount with more decimals than its currency allows is refused with E_PRECISION.

create or replace function app.currency_decimals(p_currency text)
returns integer language sql immutable set search_path = public, pg_temp as $$
  select case upper(coalesce(p_currency, ''))
    when 'XOF' then 0 when 'XAF' then 0 when 'RWF' then 0 when 'UGX' then 0 when 'BIF' then 0
    when 'GNF' then 0 when 'KMF' then 0 when 'DJF' then 0 when 'JPY' then 0
    else 2 end
$$;

create or replace function app.assert_money(p_amount numeric, p_currency text)
returns void language plpgsql immutable set search_path = public, pg_temp as $$
declare v_dp integer := app.currency_decimals(p_currency);
begin
  if p_amount is not null and round(p_amount, v_dp) <> p_amount then
    perform app.fail('E_PRECISION', format('%s amounts can have at most %s decimal places.', upper(coalesce(p_currency, 'This currency''s')), v_dp));
  end if;
end $$;
revoke all on function app.currency_decimals(text), app.assert_money(numeric, text) from public, anon;
grant execute on function app.currency_decimals(text), app.assert_money(numeric, text) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.post_charge(p_folio_id uuid, p_charge_code_id uuid, p_amount numeric, p_tax_inclusive boolean, p_description text, p_reference text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  perform app.assert_money(p_amount, f.currency);
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
end $function$;

CREATE OR REPLACE FUNCTION public.post_payment(p_folio_id uuid, p_payment_method_id uuid, p_amount numeric, p_currency text, p_is_deposit boolean, p_description text, p_reference text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  perform app.assert_money(p_amount, upper(coalesce(nullif(btrim(p_currency), ''), f.currency)));
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
end $function$;

CREATE OR REPLACE FUNCTION public.request_refund(p_folio_id uuid, p_payment_method_id uuid, p_amount numeric, p_currency text, p_reference text, p_reason text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare f public.folios; v_id uuid; v_cur text; v_rate numeric;
begin
  perform app.assert_writable(true);
  v_id := app.request_prelude(p_reason, p_idempotency_key);
  if v_id is not null then return jsonb_build_object('status', 'pending', 'approval_id', v_id); end if;
  f := app.folio_for_write(p_folio_id, 'fin.refund.post');
  if not exists (select 1 from public.payment_methods where id = p_payment_method_id and property_id = f.property_id and is_active) then
    perform app.fail('E_INVALID', 'Choose how the money is returned.'); end if;
  perform app.assert_money(p_amount, upper(coalesce(nullif(btrim(p_currency), ''), f.currency)));
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
end $function$;

CREATE OR REPLACE FUNCTION public.apply_discount(p_transaction_id uuid, p_amount numeric, p_reason text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  perform app.assert_money(p_amount, f.currency);
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
end $function$;

CREATE OR REPLACE FUNCTION public.request_adjustment(p_folio_id uuid, p_charge_code_id uuid, p_amount numeric, p_reason text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare f public.folios; v_id uuid;
begin
  perform app.assert_writable();
  v_id := app.request_prelude(p_reason, p_idempotency_key);
  if v_id is not null then return jsonb_build_object('status', 'pending', 'approval_id', v_id); end if;
  f := app.folio_for_write(p_folio_id, 'fin.adjust.post');
  perform app.assert_money(p_amount, f.currency);
  p_amount := round(coalesce(p_amount, 0), 2);
  if p_amount = 0 then perform app.fail('E_INVALID', 'Amount cannot be zero.'); end if;
  if p_charge_code_id is not null and not exists (select 1 from public.charge_codes where id = p_charge_code_id and property_id = f.property_id) then
    perform app.fail('E_INVALID', 'Charge code not found.'); end if;
  v_id := app.new_approval(f, 'adjustment', null, jsonb_build_object('charge_code_id', p_charge_code_id), p_amount, f.currency, p_reason, p_idempotency_key);
  return jsonb_build_object('status', 'pending', 'approval_id', v_id);
end $function$;

CREATE OR REPLACE FUNCTION public.create_service_request(p_reservation_id uuid, p_category text, p_description text, p_chargeable boolean DEFAULT false, p_charge_amount numeric DEFAULT NULL::numeric, p_charge_code_id uuid DEFAULT NULL::uuid, p_assignee_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    perform app.assert_money(p_charge_amount, p.base_currency);
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
end $function$;

CREATE OR REPLACE FUNCTION public.save_rate_plan_price(p_id uuid, p_rate_plan_id uuid, p_room_type_id uuid, p_valid_from date, p_valid_to date, p_amount numeric, p_currency text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_id uuid; v_property uuid; v_tenant uuid; v_cur text;
begin
  select property_id, tenant_id into v_property, v_tenant from public.rate_plans where id = p_rate_plan_id;
  if v_property is null then perform app.fail('E_NOT_FOUND', 'Rate plan not found.'); end if;
  perform app.require('setup.rate.manage', v_property);
  if not exists (select 1 from public.room_types where id = p_room_type_id and property_id = v_property) then
    perform app.fail('E_INVALID', 'Choose a room type for this property.'); end if;
  if p_valid_from is null or p_valid_to is null or p_valid_to < p_valid_from then
    perform app.fail('E_INVALID', 'The end date must be on or after the start date.'); end if;
  if p_amount is null or p_amount < 0 then perform app.fail('E_INVALID', 'Enter a price of zero or more.'); end if;
  v_cur := upper(coalesce(nullif(btrim(p_currency), ''), (select base_currency from public.properties where id = v_property)));
  perform app.assert_money(p_amount, v_cur);
  if v_cur !~ '^[A-Z]{3}$' then perform app.fail('E_INVALID', 'Currency must be a 3-letter code, e.g. NGN.'); end if;
  if exists (select 1 from public.rate_plan_prices x
             where x.rate_plan_id = p_rate_plan_id and x.room_type_id = p_room_type_id
               and x.id is distinct from p_id
               and x.valid_from <= p_valid_to and x.valid_to >= p_valid_from) then
    perform app.fail('E_OVERLAP', 'These dates overlap an existing price for this room type.');
  end if;
  if p_id is null then
    insert into public.rate_plan_prices(tenant_id, property_id, rate_plan_id, room_type_id, valid_from, valid_to, amount, currency)
    values (v_tenant, v_property, p_rate_plan_id, p_room_type_id, p_valid_from, p_valid_to, p_amount, v_cur)
    returning id into v_id;
  else
    update public.rate_plan_prices set room_type_id = p_room_type_id, valid_from = p_valid_from,
      valid_to = p_valid_to, amount = p_amount, currency = v_cur
    where id = p_id and rate_plan_id = p_rate_plan_id returning id into v_id;
    if v_id is null then perform app.fail('E_NOT_FOUND', 'Price not found.'); end if;
  end if;
  return v_id;
end $function$;


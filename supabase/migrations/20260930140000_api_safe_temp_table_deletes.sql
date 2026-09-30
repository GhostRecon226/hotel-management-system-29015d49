-- Charges work through the Supabase API (found in the step 4 click-through).
--
-- Before: posting a charge from the app failed with "DELETE requires a WHERE clause". Supabase loads the
-- safeupdate guard for every API request, which refuses an UPDATE or DELETE without WHERE. Four functions
-- empty a temporary tax-workings table with a bare DELETE: post_charge, complete_service_request,
-- post_room_charges and the nightly room charge roll (app.roll_room_charges, run by pg_cron without the
-- guard, fixed too for consistency). Nothing was posted when the guard stopped them.
-- After: the same statements say "where true". Behaviour is otherwise unchanged. A test in
-- 10_security.sql fails if any function has an UPDATE or DELETE without WHERE again.

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
  delete from _tax_lines where true;
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

CREATE OR REPLACE FUNCTION public.complete_service_request(p_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
      delete from _svc_tax where true;
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
end $function$;

CREATE OR REPLACE FUNCTION public.post_room_charges(p_property_id uuid, p_business_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    delete from _room_tax where true;
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
end $function$;

CREATE OR REPLACE FUNCTION app.roll_room_charges(p properties, p_date date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare cc public.charge_codes; s record; v_key text; v_id uuid; v_folio uuid; v_posted int := 0; l record;
begin
  select * into cc from public.charge_codes where property_id = p.id and category = 'room' and is_active order by (code = 'ROOM') desc, code limit 1;
  if cc.id is null then perform app.fail('E_INVALID', 'No active room charge code. Add one in Setup.'); end if;
  create temp table if not exists _roll_tax (line_no int, tax_code text, tax_name text, percent numeric, taxable_base numeric, amount numeric) on commit drop;
  for s in
    select st.reservation_id, n.rate_amount, rm.room_number, r.number
    from public.stays st
    join public.reservations r on r.id = st.reservation_id
    join public.reservation_nights n on n.reservation_id = r.id and n.stay_date = p_date
    join public.rooms rm on rm.id = st.room_id
    where st.property_id = p.id and st.status = 'in_house'
  loop
    v_key := 'room:' || s.reservation_id || ':' || p_date;
    continue when exists (select 1 from public.folio_transactions where tenant_id = p.tenant_id and idempotency_key = v_key);
    v_folio := app.ensure_main_folio(s.reservation_id);
    continue when (select status from public.folios where id = v_folio) <> 'open' or round(s.rate_amount, 2) <= 0;
    delete from _roll_tax where true;
    if cc.is_taxable then insert into _roll_tax select * from public.calculate_tax(p.id, round(s.rate_amount, 2), false); end if;
    insert into public.folio_transactions(tenant_id, property_id, folio_id, kind, charge_code_id, amount, currency, fx_rate,
      base_amount, tax_inclusive, description, reference, idempotency_key, business_date)
    values (p.tenant_id, p.id, v_folio, 'charge', cc.id, round(s.rate_amount, 2), p.base_currency, 1, round(s.rate_amount, 2), false,
      'Room ' || s.room_number || ' · ' || to_char(p_date, 'DD Mon YYYY'), s.number, v_key, p_date)
    returning id into v_id;
    for l in select * from _roll_tax order by line_no loop
      insert into public.folio_tax_lines(tenant_id, property_id, transaction_id, line_no, tax_code, tax_name, percent, taxable_base, amount, base_amount)
      values (p.tenant_id, p.id, v_id, l.line_no, l.tax_code, l.tax_name, l.percent, l.taxable_base, l.amount, l.amount);
    end loop;
    v_posted := v_posted + 1;
  end loop;
  return v_posted;
end $function$;

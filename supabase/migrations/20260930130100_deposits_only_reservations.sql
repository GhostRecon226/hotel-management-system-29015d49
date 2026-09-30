-- Reservation officers take deposits only (decision 6a, requirement FIN-002).
--
-- Before: the Reservation Officer role held fin.payment.post, so it could take any payment.
-- After: a new permission fin.deposit.take allows payments marked as deposits only. The Reservation
-- Officer role gets it and loses fin.payment.post. Roles that hold fin.payment.post (front desk,
-- cashier, managers) can still take deposits and every other payment. Combined with own-records folio
-- access (20260930120300), a reservation officer takes deposits on their own bookings only.

insert into public.permissions(key, description, module)
values ('fin.deposit.take', 'Take deposits on bookings', 'finance')
on conflict (key) do nothing;

-- System Administrator and General Manager must hold every permission: only they hand out roles, and
-- the escalation guard lets them give only what they hold. Without this nobody could assign the
-- Reservation Officer role after this migration.
insert into public.role_permissions(role_id, permission_key, grant_level, tenant_id)
select id, 'fin.deposit.take', 'Y', null from public.roles where tenant_id is null and code in ('RES', 'SYSADMIN', 'GM')
on conflict do nothing;

delete from public.role_permissions
where permission_key = 'fin.payment.post'
  and role_id = (select id from public.roles where tenant_id is null and code = 'RES');

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
  -- Deposits need fin.deposit.take or fin.payment.post; every other payment needs fin.payment.post (decision 6a).
  f := app.folio_for_write(p_folio_id,
    case when coalesce(p_is_deposit, false)
          and not app.can('fin.payment.post', (select property_id from public.folios where id = p_folio_id))
         then 'fin.deposit.take' else 'fin.payment.post' end);
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

CREATE OR REPLACE FUNCTION public.open_main_folio(p_reservation_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.reservations; v_id uuid;
begin
  select * into r from public.reservations where id = p_reservation_id and tenant_id = app.my_tenant();
  if r.id is null or not app.folio_scope_ok(r.property_id, r.id) then perform app.fail('E_NOT_FOUND', 'Reservation not found.'); end if;
  select id into v_id from public.folios where reservation_id = r.id and is_main;
  if v_id is not null then return v_id; end if;
  perform app.assert_writable(true);
  if not (app.can('fin.charge.post', r.property_id) or app.can('fin.payment.post', r.property_id)
          or app.can('fin.deposit.take', r.property_id)) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to open folios.'); end if;
  if r.status in ('cancelled', 'no_show') then perform app.fail('E_INVALID', 'This booking is not active.'); end if;
  return app.ensure_main_folio(r.id);
end $function$;

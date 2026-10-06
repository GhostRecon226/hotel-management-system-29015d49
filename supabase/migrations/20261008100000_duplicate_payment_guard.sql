-- Duplicate payment guard (FIN-017, wave 1, decided 6 Oct 2026, option b).
--
-- Before: a payment form kept one retry key while it was open, so a double click or a network retry never posted
-- twice. But if the connection dropped after the server saved a payment and the cashier opened the form again,
-- the second save was a new payment: the bill showed it twice until a manager approved a reversal.
-- After: post_payment refuses a payment on the same bill with the same amount, currency, method and reference
-- (or both without a reference) as a payment recorded in the last N minutes (one setting, app.settings
-- duplicate_payment_window_minutes = 10), unless the cashier confirms it with a reason. The refusal
-- ([E_POSSIBLE_DUPLICATE]) names the earlier payment: amount, method, reference, time and who recorded it.
-- A confirmed repeat is recorded and audited (payment_duplicate_confirmed, with the reason and the earlier
-- payment's id). A retry with the same key still returns the first payment. An earlier payment that has been
-- reversed no longer counts. The bill is locked while posting (app.folio_for_write), so two tills cannot race.
-- Otherwise the function is unchanged (its definition from 20260930130100_deposits_only_reservations.sql).

insert into app.settings(key, value, description) values
  ('duplicate_payment_window_minutes', '10', 'A payment matching one on the same bill within this many minutes needs the cashier''s confirmation (FIN-017). 0 switches the check off.')
on conflict (key) do nothing;

drop function public.post_payment(uuid, uuid, numeric, text, boolean, text, text, text);

create function public.post_payment(p_folio_id uuid, p_payment_method_id uuid, p_amount numeric, p_currency text,
  p_is_deposit boolean, p_description text, p_reference text, p_idempotency_key text, p_confirm_duplicate_reason text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $function$
declare f public.folios; pm public.payment_methods; v_id uuid; v_rate numeric; v_cur text; v_date date;
  v_window integer; v_prev public.folio_transactions; v_ref text := nullif(btrim(p_reference), ''); v_who text; v_tz text;
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

  -- FIN-017: a likely repeat of a payment recorded a few minutes ago.
  v_window := coalesce(app.setting_int('duplicate_payment_window_minutes'), 10);
  if v_window > 0 then
    select t.* into v_prev from public.folio_transactions t
    where t.folio_id = f.id and t.kind = 'payment' and t.payment_method_id = pm.id
      and t.amount = -p_amount and t.currency = v_cur and coalesce(t.reference, '') = coalesce(v_ref, '')
      and t.posted_at > now() - make_interval(mins => v_window)
      and not exists (select 1 from public.folio_transactions r where r.original_id = t.id and r.kind = 'reversal')
    order by t.posted_at desc limit 1;
    if v_prev.id is not null and coalesce(btrim(p_confirm_duplicate_reason), '') = '' then
      select full_name into v_who from public.profiles where id = v_prev.posted_by;
      select timezone into v_tz from public.properties where id = f.property_id;
      perform app.fail('E_POSSIBLE_DUPLICATE', format(
        'A payment of %s %s by %s%s was recorded on this bill at %s%s. If this is a second payment, confirm it with a reason.',
        v_cur, to_char(p_amount, 'FM999,999,999,990.00'), pm.name,
        case when v_ref is null then ' (no reference)' else ' (reference ' || v_ref || ')' end,
        to_char(v_prev.posted_at at time zone coalesce(v_tz, 'Africa/Lagos'), 'HH24:MI'),
        case when v_who is null then '' else ' by ' || v_who end));
    end if;
  end if;

  select business_date into v_date from public.properties where id = f.property_id;
  v_rate := app.fx_rate(f.property_id, v_cur, v_date);
  begin
    insert into public.folio_transactions(tenant_id, property_id, folio_id, kind, payment_method_id, amount, currency, fx_rate,
      base_amount, is_deposit, description, reference, idempotency_key, business_date)
    values (f.tenant_id, f.property_id, f.id, 'payment', pm.id, -p_amount, v_cur, v_rate, -round(p_amount * v_rate, 2),
      coalesce(p_is_deposit, false), coalesce(nullif(btrim(p_description), ''), pm.name || ' payment'),
      v_ref, p_idempotency_key, v_date)
    returning id into v_id;
  exception when unique_violation then
    return app.existing_tx(p_idempotency_key);
  end;

  if v_prev.id is not null then
    insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after, reason)
    values (f.tenant_id, auth.uid(), 'payment_duplicate_confirmed', 'folio_transactions', v_id::text,
      jsonb_build_object('earlier_transaction_id', v_prev.id, 'folio_id', f.id, 'amount', p_amount, 'currency', v_cur,
        'payment_method_id', pm.id), btrim(p_confirm_duplicate_reason));
  end if;
  return v_id;
end $function$;

revoke all on function public.post_payment(uuid, uuid, numeric, text, boolean, text, text, text, text) from public, anon;
grant execute on function public.post_payment(uuid, uuid, numeric, text, boolean, text, text, text, text) to authenticated;

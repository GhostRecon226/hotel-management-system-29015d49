-- A guest booked overnight who checks in and leaves on the same business day is charged one night
-- (Peter, 1 Oct 2026, extending DAY-006). A manager can waive it with a reason.
--
-- Before: checking out on the arrival day removed the unused nights, so the guest paid nothing for the room.
-- After:
--   * While such a guest is in house, check-out outstanding includes one night (the first night's rate, with
--     tax), and public.preview_check_out_charge shows it to the check-out screen.
--   * The desk can post it with public.post_check_out_charge before taking payment; check-out posts it anyway
--     if it is still missing, so it is never skipped. Same key as the nightly room charge for that date.
--   * public.waive_same_day_charge (res.rate.override, reason required) now also works before the charge is
--     posted: it marks the stay as waived. After posting it reverses the charge, as before.
--   * A guest who stayed a night (checked in on an earlier business date) is never charged this.
--   * Check-out on the arrival day sets the departure date to that day.

alter table public.stays add column same_day_waive_reason text,
  add column same_day_waived_by uuid references public.profiles(id), add column same_day_waived_at timestamptz;

-- Posts one night labelled "same-day stay" on the booking's main folio. Shared by check-in of a same-day
-- booking and check-out on the arrival day.
create or replace function app.insert_same_day_charge(p_res uuid, p_amount numeric)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; p public.properties; cc public.charge_codes; v_folio uuid; v_key text; v_id uuid;
  v_amt numeric; v_rn text; l record;
begin
  select * into r from public.reservations where id = p_res;
  select * into p from public.properties where id = r.property_id;
  select * into cc from public.charge_codes where property_id = p.id and category = 'room' and is_active order by (code = 'ROOM') desc, code limit 1;
  if cc.id is null then perform app.fail('E_INVALID', 'No active room charge code. Add one in Setup.'); end if;
  v_amt := round(coalesce(p_amount, 0), 2);
  if v_amt <= 0 then return null; end if;
  select rm.room_number into v_rn from public.room_assignments a join public.rooms rm on rm.id = a.room_id
  where a.reservation_id = r.id and a.is_active limit 1;
  -- Same key as the nightly room charge for this date, so the roll never charges the night again.
  v_key := 'room:' || r.id || ':' || p.business_date;
  if exists (select 1 from public.folio_transactions where tenant_id = p.tenant_id and idempotency_key = v_key) then
    v_key := v_key || ':' || gen_random_uuid();
  end if;
  v_folio := app.ensure_main_folio(r.id);
  insert into public.folio_transactions(tenant_id, property_id, folio_id, kind, charge_code_id, amount, currency, fx_rate,
    base_amount, tax_inclusive, description, reference, idempotency_key, business_date)
  values (p.tenant_id, p.id, v_folio, 'charge', cc.id, v_amt, p.base_currency, 1, v_amt, false,
    'Room ' || coalesce(v_rn, '') || ' · same-day stay · ' || to_char(p.business_date, 'DD Mon YYYY'), r.number, v_key, p.business_date)
  returning id into v_id;
  if cc.is_taxable then
    for l in select * from public.calculate_tax(p.id, v_amt, false) order by line_no loop
      insert into public.folio_tax_lines(tenant_id, property_id, transaction_id, line_no, tax_code, tax_name, percent, taxable_base, amount, base_amount)
      values (p.tenant_id, p.id, v_id, l.line_no, l.tax_code, l.tax_name, l.percent, l.taxable_base, l.amount, l.amount);
    end loop;
  end if;
  return v_id;
end $$;

create or replace function app.post_same_day_charge(p_res uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (app.same_day_charge(p_res)).id is not null then return null; end if;
  return app.insert_same_day_charge(p_res, (select total_amount from public.reservations where id = p_res));
end $$;

-- The one night owed by an overnight booking that checks out on the business day it checked in (0 if none).
create or replace function app.check_out_night(p_res uuid)
returns numeric language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r public.reservations; v_bdate date; v_first date; v_amt numeric;
begin
  select * into r from public.reservations where id = p_res;
  if r.id is null or r.status <> 'checked_in' or r.arrival_date = r.departure_date then return 0; end if;
  select business_date into v_bdate from public.properties where id = r.property_id;
  select min(business_date) into v_first from public.stays where reservation_id = p_res and status <> 'voided';
  if v_first is distinct from v_bdate then return 0; end if;  -- stayed at least one night
  if exists (select 1 from public.stays where reservation_id = p_res and status = 'in_house' and same_day_waive_reason is not null) then return 0; end if;
  if exists (select 1 from public.folio_transactions t join public.folios f on f.id = t.folio_id
             where f.reservation_id = p_res and t.kind = 'charge' and t.idempotency_key like 'room:' || p_res || ':%'
               and not exists (select 1 from public.folio_transactions x where x.original_id = t.id and x.kind = 'reversal')) then
    return 0;  -- already charged
  end if;
  select rate_amount into v_amt from public.reservation_nights where reservation_id = p_res and stay_date = v_bdate;
  if v_amt is null then
    select rate_amount into v_amt from public.reservation_nights where reservation_id = p_res order by stay_date limit 1;
  end if;
  return round(coalesce(v_amt, 0), 2);
end $$;

-- The same night with tax, as it would post.
create or replace function app.check_out_night_total(p_res uuid)
returns numeric language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_amt numeric := app.check_out_night(p_res); v_prop uuid; v_taxable boolean;
begin
  if v_amt <= 0 then return 0; end if;
  select property_id into v_prop from public.reservations where id = p_res;
  select is_taxable into v_taxable from public.charge_codes where property_id = v_prop and category = 'room' and is_active
  order by (code = 'ROOM') desc, code limit 1;
  return v_amt + case when coalesce(v_taxable, false)
    then coalesce((select sum(amount) from public.calculate_tax(v_prop, v_amt, false)), 0) else 0 end;
end $$;

revoke all on function app.insert_same_day_charge(uuid, numeric), app.post_same_day_charge(uuid), app.check_out_night(uuid),
  app.check_out_night_total(uuid) from public, anon, authenticated;

-- What check-out must settle: every folio's balance (owed or owed back), counting the pending same-day night
-- on the main folio as if it were already posted. A guest who paid the night up front therefore owes nothing.
create or replace function app.checkout_due(p_res uuid)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(sum(abs(app.folio_balance(f.id)
           + case when f.id = (select m.id from public.folios m where m.reservation_id = p_res and m.is_main and m.status = 'open' limit 1)
                  then app.check_out_night_total(p_res) else 0 end)), 0)
    + case when not exists (select 1 from public.folios m where m.reservation_id = p_res and m.is_main and m.status = 'open')
           then app.check_out_night_total(p_res) else 0 end
  from public.folios f where f.reservation_id = p_res
$$;
revoke all on function app.checkout_due(uuid) from public, anon, authenticated;

create or replace function public.preview_check_out_charge(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r public.reservations; v_amt numeric;
begin
  select * into r from public.reservations where id = p_id and tenant_id = app.my_tenant();
  if r.id is null or not app.folio_scope_ok(r.property_id, r.id) then perform app.fail('E_NOT_FOUND', 'Reservation not found.'); end if;
  v_amt := app.check_out_night(p_id);
  -- posted: a same-day night is on the folio and can still be waived (the check-out screen shows it).
  return jsonb_build_object('applies', v_amt > 0, 'amount', v_amt, 'total', app.check_out_night_total(p_id),
    'posted', r.status = 'checked_in' and (app.same_day_charge(p_id)).id is not null,
    'currency', (select base_currency from public.properties where id = r.property_id));
end $$;

create or replace function public.post_check_out_charge(p_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; v_amt numeric; v_tx uuid;
begin
  perform app.assert_writable(true);
  r := app.reservation_for_write(p_id, 'fo.checkout');
  v_amt := app.check_out_night(p_id);
  if v_amt <= 0 then return null; end if;
  v_tx := app.insert_same_day_charge(p_id, v_amt);
  perform app.log_res(r, 'same_day_charge', null, jsonb_build_object('transaction_id', v_tx, 'amount', v_amt));
  return v_tx;
end $$;
revoke all on function public.preview_check_out_charge(uuid), public.post_check_out_charge(uuid) from public, anon;
grant execute on function public.preview_check_out_charge(uuid), public.post_check_out_charge(uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.checkout_outstanding(p_reservation_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.reservations;
begin
  select * into r from public.reservations where id = p_reservation_id and tenant_id = app.my_tenant();
  if r.id is null or not app.folio_scope_ok(r.property_id, r.id) then perform app.fail('E_NOT_FOUND', 'Reservation not found.'); end if;
  return app.checkout_due(p_reservation_id);
end $function$;

CREATE OR REPLACE FUNCTION public.check_out(p_id uuid, p_approval_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

  -- Leaving on the business day of check-in: one night is charged unless a manager waived it.
  if app.check_out_night(r.id) > 0 then
    perform app.insert_same_day_charge(r.id, app.check_out_night(r.id));
  end if;
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
    departure_date = case when v_bdate >= arrival_date and v_bdate < departure_date then v_bdate else departure_date end
  where id = r.id;

  update public.room_assignments set is_active = false, released_at = now() where reservation_id = r.id and is_active;
  update public.rooms set is_occupied = false, condition = 'dirty' where id = s.room_id;

  v_task := app.hk_new_turnover(s.room_id, s.id, 'Check-out ' || r.number);

  update public.stays set status = 'checked_out', checked_out_at = now(), checked_out_by = auth.uid(),
    checkout_business_date = v_bdate, checkout_approval_id = a.id, checkout_reason = nullif(btrim(p_reason), ''),
    checkout_snapshot = jsonb_build_object('closed_folios', to_jsonb(v_closed), 'nights', v_nights,
      'departure_date', v_old_dep, 'task_id', v_task, 'outstanding', v_out)
  where id = s.id;

  perform app.log_res(r, 'check_out', p_reason, jsonb_strip_nulls(jsonb_build_object(
    'outstanding', nullif(v_out, 0), 'approval_id', a.id, 'closed_folios', cardinality(v_closed))));
  return s.id;
end $function$;

CREATE OR REPLACE FUNCTION public.waive_same_day_charge(p_id uuid, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.reservations; v_tx uuid;
begin
  perform app.assert_writable(true);
  select * into r from public.reservations where id = p_id and tenant_id = app.my_tenant();
  if r.id is null then perform app.fail('E_NOT_FOUND', 'Reservation not found.'); end if;
  if not app.can('res.rate.override', r.property_id) then
    perform app.fail('E_FORBIDDEN', 'Only a manager can waive the same-day charge.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  v_tx := app.reverse_same_day_charge(p_id, 'Same-day charge waived: ' || btrim(p_reason), 'waive-same-day');
  if v_tx is null and app.check_out_night(p_id) <= 0 then
    perform app.fail('E_INVALID', 'There is no same-day charge to waive on this booking.'); end if;
  -- Mark the stay so check-out does not charge the night (before it posts) or charge it again (after).
  update public.stays set same_day_waive_reason = btrim(p_reason), same_day_waived_by = auth.uid(), same_day_waived_at = now()
  where reservation_id = p_id and status = 'in_house';
  perform app.log_res(r, 'waive_same_day_charge', p_reason, jsonb_strip_nulls(jsonb_build_object('reversal_id', v_tx, 'before_posting', case when v_tx is null then true end)));
  return v_tx;
end $function$;

-- The approval for checking out with a balance covers the pending same-day night too.
CREATE OR REPLACE FUNCTION public.request_unsettled_checkout(p_id uuid, p_reason text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.reservations; v_existing uuid; v_out numeric; v_folio uuid; f public.folios; a public.approvals;
begin
  perform app.assert_writable(true);
  v_existing := app.request_prelude(p_reason, p_idempotency_key);
  if v_existing is not null then return jsonb_build_object('status', 'pending', 'approval_id', v_existing); end if;
  r := app.reservation_for_write(p_id, 'fo.checkout');
  perform set_config('app.settlement', 'on', true);
  if r.status <> 'checked_in' then perform app.fail('E_INVALID', 'Only in-house guests can be checked out.'); end if;
  v_out := app.checkout_due(r.id);  -- includes a pending same-day night
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
end $function$;

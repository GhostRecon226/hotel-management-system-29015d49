-- Cancellation and no-show fees (audit finding M7, requirements SET-004, RES-006, RES-007).
--
-- Before: the fee was worked out and stored on the reservation but never posted to a folio, every
-- cancellation was charged however early it came, and anyone who could cancel could waive the fee.
-- After (adapted from the reference design):
--   - a rate plan can say how many days before arrival cancellation is free (cancellation_free_days);
--     empty means the fee always applies, which is how existing plans behaved;
--   - waiving a fee needs the rate override permission (res.rate.override) and a reason;
--   - when a booking becomes cancelled or no-show with a fee that is not waived, the fee is posted to
--     its main folio once (idempotency key fee:<status>:<reservation>). This covers the front desk,
--     the manager and the nightly roll, because it runs on the status change itself.
--   - fees post to their own charge codes, not taxed until the accountant confirms (decision A11).

alter table public.rate_plans add column cancellation_free_days integer check (cancellation_free_days >= 0);
comment on column public.rate_plans.cancellation_free_days is
  'Cancelling at least this many days before arrival is free. Empty: the cancellation fee always applies.';

-- save_rate_plan gains the free-cancellation setting as an optional last argument.
drop function public.save_rate_plan(uuid, uuid, text, text, boolean, text, numeric, text, numeric, text, numeric, boolean);
create or replace function public.save_rate_plan(p_property_id uuid, p_id uuid, p_code text, p_name text, p_is_corporate boolean,
  p_cancellation_type text, p_cancellation_value numeric, p_no_show_type text, p_no_show_value numeric,
  p_deposit_type text, p_deposit_value numeric, p_is_active boolean, p_cancellation_free_days integer default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_tenant uuid;
begin
  perform app.require('setup.rate.manage', p_property_id);
  if coalesce(btrim(p_code), '') = '' or coalesce(btrim(p_name), '') = '' then
    perform app.fail('E_REQUIRED', 'Code and name are required.'); end if;
  perform app.check_policy('Cancellation policy', p_cancellation_type, p_cancellation_value);
  perform app.check_policy('No-show policy', p_no_show_type, p_no_show_value);
  perform app.check_policy('Deposit policy', p_deposit_type, p_deposit_value);
  if p_cancellation_free_days is not null and p_cancellation_free_days < 0 then
    perform app.fail('E_INVALID', 'Free cancellation days cannot be negative.'); end if;
  select tenant_id into v_tenant from public.properties where id = p_property_id;
  begin
    if p_id is null then
      insert into public.rate_plans(tenant_id, property_id, code, name, is_corporate,
        cancellation_policy_type, cancellation_policy_value, no_show_policy_type, no_show_policy_value,
        deposit_policy_type, deposit_policy_value, is_active, cancellation_free_days)
      values (v_tenant, p_property_id, upper(btrim(p_code)), btrim(p_name), coalesce(p_is_corporate, false),
        p_cancellation_type, coalesce(p_cancellation_value, 0), p_no_show_type, coalesce(p_no_show_value, 0),
        p_deposit_type, coalesce(p_deposit_value, 0), coalesce(p_is_active, true), p_cancellation_free_days)
      returning id into v_id;
    else
      update public.rate_plans set code = upper(btrim(p_code)), name = btrim(p_name),
        is_corporate = coalesce(p_is_corporate, false),
        cancellation_policy_type = p_cancellation_type, cancellation_policy_value = coalesce(p_cancellation_value, 0),
        no_show_policy_type = p_no_show_type, no_show_policy_value = coalesce(p_no_show_value, 0),
        deposit_policy_type = p_deposit_type, deposit_policy_value = coalesce(p_deposit_value, 0),
        is_active = coalesce(p_is_active, true), cancellation_free_days = p_cancellation_free_days
      where id = p_id and property_id = p_property_id returning id into v_id;
      if v_id is null then perform app.fail('E_NOT_FOUND', 'Rate plan not found.'); end if;
    end if;
  exception when unique_violation then
    perform app.fail('E_DUPLICATE', 'That rate plan code is already used.');
  end;
  return v_id;
end $$;
revoke all on function public.save_rate_plan(uuid, uuid, text, text, boolean, text, numeric, text, numeric, text, numeric, boolean, integer) from public, anon;
grant execute on function public.save_rate_plan(uuid, uuid, text, text, boolean, text, numeric, text, numeric, text, numeric, boolean, integer) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cancel_reservation(p_id uuid, p_reason text, p_waive_fee boolean DEFAULT false, p_waive_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.reservations; rp public.rate_plans; v_fee numeric; v_bdate date;
begin
  r := app.reservation_for_write(p_id, 'res.cancel');
  if r.status not in ('tentative', 'confirmed') then perform app.fail('E_INVALID', 'Only tentative or confirmed bookings can be cancelled.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  if coalesce(p_waive_fee, false) and coalesce(btrim(p_waive_reason), '') = '' then
    perform app.fail('E_REQUIRED', 'A reason is required to waive the fee.'); end if;
  if coalesce(p_waive_fee, false) and not app.can('res.rate.override', r.property_id) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to waive fees.'); end if;
  select * into rp from public.rate_plans where id = r.rate_plan_id;
  select business_date into v_bdate from public.properties where id = r.property_id;
  v_fee := case when rp.cancellation_free_days is not null and r.arrival_date - v_bdate >= rp.cancellation_free_days then 0
                else app.policy_amount(rp.cancellation_policy_type, rp.cancellation_policy_value, p_id) end;
  perform set_config('app.audit_reason', btrim(p_reason), true);
  perform app.release_rooms(p_id);
  update public.reservations set status = 'cancelled', cancellation_fee = v_fee, fee_waived = coalesce(p_waive_fee, false),
    status_reason = btrim(p_reason), cancelled_at = now(), hold_until = null, updated_at = now()
  where id = p_id;
  if coalesce(p_waive_fee, false) and v_fee > 0 then
    perform app.log_res(r, 'waive_cancellation_fee', p_waive_reason, jsonb_build_object('fee', v_fee));
  end if;
  perform set_config('app.audit_reason', '', true);
  return jsonb_build_object('fee', v_fee, 'waived', coalesce(p_waive_fee, false),
    'charged', case when coalesce(p_waive_fee, false) then 0 else v_fee end, 'currency', r.currency);
end $function$;

CREATE OR REPLACE FUNCTION public.mark_no_show(p_id uuid, p_reason text, p_waive_fee boolean DEFAULT false, p_waive_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.reservations; rp public.rate_plans; v_fee numeric; v_bdate date;
begin
  r := app.reservation_for_write(p_id, 'res.noshow');
  if r.status not in ('tentative', 'confirmed') then perform app.fail('E_INVALID', 'Only tentative or confirmed bookings can be marked as no-show.'); end if;
  select business_date into v_bdate from public.properties where id = r.property_id;
  if r.arrival_date > v_bdate then perform app.fail('E_INVALID', 'You can mark a no-show only on or after the arrival date.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  if coalesce(p_waive_fee, false) and coalesce(btrim(p_waive_reason), '') = '' then
    perform app.fail('E_REQUIRED', 'A reason is required to waive the fee.'); end if;
  if coalesce(p_waive_fee, false) and not app.can('res.rate.override', r.property_id) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to waive fees.'); end if;
  select * into rp from public.rate_plans where id = r.rate_plan_id;
  v_fee := app.policy_amount(rp.no_show_policy_type, rp.no_show_policy_value, p_id);
  perform set_config('app.audit_reason', btrim(p_reason), true);
  perform app.release_rooms(p_id);
  update public.reservations set status = 'no_show', no_show_fee = v_fee, fee_waived = coalesce(p_waive_fee, false),
    status_reason = btrim(p_reason), hold_until = null, updated_at = now()
  where id = p_id;
  if coalesce(p_waive_fee, false) and v_fee > 0 then
    perform app.log_res(r, 'waive_no_show_fee', p_waive_reason, jsonb_build_object('fee', v_fee));
  end if;
  perform set_config('app.audit_reason', '', true);
  return jsonb_build_object('fee', v_fee, 'waived', coalesce(p_waive_fee, false),
    'charged', case when coalesce(p_waive_fee, false) then 0 else v_fee end, 'currency', r.currency);
end $function$;

-- Post the fee when a booking becomes cancelled or no-show.
create or replace function app.post_reservation_fee()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_fee numeric; v_code text; v_name text; v_key text; v_folio uuid; v_cc uuid; v_cur text; v_bdate date;
begin
  if new.status = old.status or new.status not in ('cancelled', 'no_show') or coalesce(new.fee_waived, false) then return null; end if;
  v_fee := case new.status when 'cancelled' then coalesce(new.cancellation_fee, 0) else coalesce(new.no_show_fee, 0) end;
  if v_fee <= 0 then return null; end if;
  v_code := case new.status when 'cancelled' then 'CXLFEE' else 'NOSHOW' end;
  v_name := case new.status when 'cancelled' then 'Cancellation fee' else 'No-show fee' end;
  v_key := 'fee:' || new.status || ':' || new.id;
  if exists (select 1 from public.folio_transactions where idempotency_key = v_key) then return null; end if;

  insert into public.charge_codes(tenant_id, property_id, code, name, category, is_taxable)
  values (new.tenant_id, new.property_id, v_code, v_name, 'other', false)
  on conflict (property_id, code) do nothing;
  select id into v_cc from public.charge_codes where property_id = new.property_id and code = v_code;

  v_folio := app.ensure_main_folio(new.id);
  select currency into v_cur from public.folios where id = v_folio;
  select business_date into v_bdate from public.properties where id = new.property_id;
  insert into public.folio_transactions(tenant_id, property_id, folio_id, kind, charge_code_id, amount, currency, fx_rate,
    base_amount, tax_inclusive, description, reference, idempotency_key, business_date)
  values (new.tenant_id, new.property_id, v_folio, 'charge', v_cc, v_fee, v_cur, 1, v_fee, false,
    v_name || ' for ' || new.number, new.number, v_key, v_bdate);
  return null;
end $$;
revoke all on function app.post_reservation_fee() from public, anon, authenticated;

create trigger reservations_post_fee after update of status on public.reservations
  for each row execute function app.post_reservation_fee();

-- Fee charge codes for every existing property. Not taxed until the accountant confirms (A11).
insert into public.charge_codes(tenant_id, property_id, code, name, category, is_taxable)
select p.tenant_id, p.id, x.code, x.name, 'other', false
from public.properties p cross join (values ('CXLFEE', 'Cancellation fee'), ('NOSHOW', 'No-show fee')) x(code, name)
on conflict (property_id, code) do nothing;

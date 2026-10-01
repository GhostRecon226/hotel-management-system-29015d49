-- Same-day stays (decision DAY-006, building on D9).
--
-- Before: a booking had to depart at least one day after it arrived, so the desk could not record a guest who
-- arrives and leaves on the same day.
-- After:
--   * Arrival and departure can be the same day. The booking keeps its dates and has no night rows (D9), so it
--     does not use up a room for the night in availability. Its total is one night's rate, and cancellation,
--     no-show and deposit rules treat it as a one-night stay.
--   * Check-in posts one night (room charge code, with tax) labelled "same-day stay". It uses the same key
--     as the nightly room charge for that date, so a guest still in house at the roll is not charged twice.
--   * A manager (res.rate.override, the permission that waives fees) can waive it with a reason:
--     public.waive_same_day_charge. It posts a reversal and records the reason in the booking history.
--   * Voiding the check-in reverses the charge; checking in again charges it again.
--   * The assigned room is held from arrival to the next day, so the same room cannot be given to an
--     overnight guest arriving that day.

alter table public.reservations drop constraint reservations_dates_chk;
alter table public.reservations add constraint reservations_dates_chk check (departure_date >= arrival_date);

-- A same-day room assignment holds the room until the next day.
create or replace function app.room_assignment_same_day()
returns trigger language plpgsql as $$
begin
  if new.to_date <= new.from_date then new.to_date := new.from_date + 1; end if;
  return new;
end $$;
create trigger room_assignments_same_day before insert or update on public.room_assignments
  for each row execute function app.room_assignment_same_day();

CREATE OR REPLACE FUNCTION app.validate_stay(p_property uuid, p_arrival date, p_departure date, p_room_type uuid, p_rate_plan uuid, p_adults integer, p_children integer)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_max int; rt public.room_types;
begin
  if p_arrival is null or p_departure is null then perform app.fail('E_REQUIRED', 'Arrival and departure dates are required.'); end if;
  if p_departure < p_arrival then perform app.fail('E_INVALID', 'Departure cannot be before arrival.'); end if;
  select max_stay_nights into v_max from public.properties where id = p_property;
  if p_departure - p_arrival > v_max then
    perform app.fail('E_INVALID', 'Stays can be at most ' || v_max || ' nights at this property.'); end if;
  select * into rt from public.room_types where id = p_room_type and property_id = p_property and is_active;
  if rt.id is null then perform app.fail('E_INVALID', 'Choose a room type for this property.'); end if;
  if not exists (select 1 from public.rate_plans where id = p_rate_plan and property_id = p_property and is_active) then
    perform app.fail('E_INVALID', 'Choose a rate plan for this property.'); end if;
  if coalesce(p_adults, 0) < 1 then perform app.fail('E_INVALID', 'At least one adult is required.'); end if;
  if p_adults > rt.max_adults then perform app.fail('E_INVALID', rt.name || ' takes at most ' || rt.max_adults || ' adults.'); end if;
  if coalesce(p_children, 0) < 0 or p_children > rt.max_children then
    perform app.fail('E_INVALID', rt.name || ' takes at most ' || rt.max_children || ' children.'); end if;
end $function$;

CREATE OR REPLACE FUNCTION public.get_availability(p_property_id uuid, p_arrival date, p_departure date)
 RETURNS TABLE(room_type_id uuid, room_type_code text, room_type_name text, stay_date date, sellable integer, reserved integer, available integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not app.can('res.view', p_property_id) then perform app.fail('E_FORBIDDEN', 'You do not have permission to view reservations.'); end if;
  if p_arrival is null or p_departure is null or p_departure < p_arrival then
    perform app.fail('E_INVALID', 'Departure cannot be before arrival.'); end if;
  if p_departure - p_arrival > 62 then perform app.fail('E_INVALID', 'Show at most 62 nights at a time.'); end if;
  return query
  select a.room_type_id, rt.code, rt.name, a.stay_date, a.sellable, a.reserved, a.sellable - a.reserved
  from app.availability(p_property_id, p_arrival, greatest(p_departure, p_arrival + 1), null) a
  join public.room_types rt on rt.id = a.room_type_id
  order by rt.code, a.stay_date;
end $function$;

CREATE OR REPLACE FUNCTION public.get_front_desk_rooms(p_property_id uuid, p_room_type_id uuid, p_from date, p_to date, p_reservation_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, room_number text, floor text, room_type_id uuid, room_type_code text, condition text, is_occupied boolean, is_ready boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not app.can('fo.view', p_property_id) then perform app.fail('E_FORBIDDEN', 'You do not have permission to view the front desk.'); end if;
  if p_from is null or p_to is null or p_to < p_from then perform app.fail('E_INVALID', 'Departure cannot be before arrival.'); end if;
  return query
  select rm.id, rm.room_number, rm.floor, rm.room_type_id, rt.code, rm.condition, rm.is_occupied, app.room_ready(rm)
  from public.rooms rm join public.room_types rt on rt.id = rm.room_type_id
  where rm.property_id = p_property_id and rm.is_active and rm.condition <> 'out_of_order'
    and (p_room_type_id is null or rm.room_type_id = p_room_type_id)
    and not app.room_blocked(rm.id, p_from, p_to)
    and not exists (select 1 from public.room_assignments a
      where a.room_id = rm.id and a.is_active and a.reservation_id is distinct from p_reservation_id
        and daterange(a.from_date, a.to_date, '[)') && daterange(p_from, greatest(p_to, p_from + 1), '[)'))
  order by rt.code, length(rm.room_number), rm.room_number;
end $function$;

CREATE OR REPLACE FUNCTION public.get_assignable_rooms(p_id uuid)
 RETURNS TABLE(id uuid, room_number text, floor text, condition text, is_occupied boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.reservations;
begin
  select * into r from public.reservations x where x.id = p_id and x.tenant_id = app.my_tenant();
  if r.id is null or not app.can('res.view', r.property_id) then perform app.fail('E_NOT_FOUND', 'Reservation not found.'); end if;
  return query
  select rm.id, rm.room_number, rm.floor, rm.condition, rm.is_occupied
  from public.rooms rm
  where rm.room_type_id = r.room_type_id and rm.is_active and rm.condition <> 'out_of_order'
    and not app.room_blocked(rm.id, r.arrival_date, greatest(r.departure_date, r.arrival_date + 1))
    and not exists (select 1 from public.room_assignments a
      where a.room_id = rm.id and a.is_active and a.reservation_id <> r.id
        and daterange(a.from_date, a.to_date, '[)') && daterange(r.arrival_date, greatest(r.departure_date, r.arrival_date + 1), '[)'))
  order by length(rm.room_number), rm.room_number;
end $function$;

-- One night's rate for a same-day stay (the arrival date's price, or the override).
create or replace function app.same_day_rate(r public.reservations)
returns numeric language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_amt numeric;
begin
  if r.rate_override is not null then return r.rate_override; end if;
  select p.amount into v_amt from public.rate_plan_prices p
  where p.rate_plan_id = r.rate_plan_id and p.room_type_id = r.room_type_id and r.arrival_date between p.valid_from and p.valid_to
  limit 1;
  if v_amt is null then
    perform app.fail('E_NO_RATE', 'No price is set for this rate plan and room type on ' || to_char(r.arrival_date, 'DD Mon YYYY') || '.');
  end if;
  return v_amt;
end $$;
revoke all on function app.same_day_rate(public.reservations) from public, anon, authenticated;

create or replace function app.rebuild_nights(p_res uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; rp public.rate_plans; d date; v_amt numeric; v_cur text; v_total numeric := 0;
begin
  select * into r from public.reservations where id = p_res;
  delete from public.reservation_nights where reservation_id = p_res;
  for d in select g::date from generate_series(r.arrival_date, r.departure_date - 1, interval '1 day') g loop
    select p.amount, p.currency into v_amt, v_cur from public.rate_plan_prices p
    where p.rate_plan_id = r.rate_plan_id and p.room_type_id = r.room_type_id and d between p.valid_from and p.valid_to
    limit 1;
    if v_amt is null then
      perform app.fail('E_NO_RATE', 'No price is set for this rate plan and room type on ' || to_char(d, 'DD Mon YYYY') || '.');
    end if;
    if r.rate_override is not null then v_amt := r.rate_override; end if;
    insert into public.reservation_nights(tenant_id, property_id, reservation_id, room_type_id, stay_date, rate_amount, room_id)
    values (r.tenant_id, r.property_id, r.id, r.room_type_id, d, v_amt,
      (select a.room_id from public.room_assignments a
        where a.reservation_id = r.id and a.is_active and d >= a.from_date and d < a.to_date limit 1));
    v_total := v_total + v_amt;
  end loop;
  if r.departure_date = r.arrival_date then  -- same-day stay: no night rows, charged one night (DAY-006)
    v_total := app.same_day_rate(r);
    select p.currency into v_cur from public.rate_plan_prices p
    where p.rate_plan_id = r.rate_plan_id and p.room_type_id = r.room_type_id and r.arrival_date between p.valid_from and p.valid_to limit 1;
  end if;
  select * into rp from public.rate_plans where id = r.rate_plan_id;
  update public.reservations set total_amount = v_total, currency = coalesce(v_cur, currency), updated_at = now() where id = p_res;
  update public.reservations set deposit_required = app.policy_amount(rp.deposit_policy_type, rp.deposit_policy_value, p_res)
  where id = p_res;
end $$;

-- Fees and deposits: a same-day stay counts as one night at its total.
create or replace function app.policy_amount(p_type text, p_value numeric, p_res uuid)
returns numeric language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_total numeric; v_same_day boolean;
begin
  select arrival_date = departure_date, total_amount into v_same_day, v_total from public.reservations where id = p_res;
  if not coalesce(v_same_day, false) then
    select coalesce(sum(rate_amount), 0) into v_total from public.reservation_nights where reservation_id = p_res;
  end if;
  return case p_type
    when 'nights' then case when v_same_day then case when ceil(coalesce(p_value, 0)) >= 1 then v_total else 0 end
      else (select coalesce(sum(x.rate_amount), 0) from (
        select rate_amount from public.reservation_nights where reservation_id = p_res
        order by stay_date limit ceil(coalesce(p_value, 0))::int) x) end
    when 'percent' then round(v_total * coalesce(p_value, 0) / 100, 2)
    when 'amount' then coalesce(p_value, 0)
    else 0 end;
end $$;

-- The same-day charge on a booking that has not been reversed, if any.
create or replace function app.same_day_charge(p_res uuid)
returns public.folio_transactions language sql stable security definer set search_path = public, pg_temp as $$
  select t.* from public.folio_transactions t join public.folios f on f.id = t.folio_id
  where f.reservation_id = p_res and t.kind = 'charge' and t.idempotency_key like 'room:' || p_res || ':%'
    and t.description like '%same-day stay%'
    and not exists (select 1 from public.folio_transactions x where x.original_id = t.id and x.kind = 'reversal')
  order by t.posted_at desc limit 1
$$;

create or replace function app.post_same_day_charge(p_res uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; p public.properties; cc public.charge_codes; v_folio uuid; v_key text; v_id uuid;
  v_amt numeric; v_rn text; l record;
begin
  select * into r from public.reservations where id = p_res;
  if (app.same_day_charge(p_res)).id is not null then return null; end if;
  select * into p from public.properties where id = r.property_id;
  select * into cc from public.charge_codes where property_id = p.id and category = 'room' and is_active order by (code = 'ROOM') desc, code limit 1;
  if cc.id is null then perform app.fail('E_INVALID', 'No active room charge code. Add one in Setup.'); end if;
  v_amt := round(r.total_amount, 2);
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

create or replace function app.reverse_same_day_charge(p_res uuid, p_reason text, p_key_prefix text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.folio_transactions;
begin
  t := app.same_day_charge(p_res);
  if t.id is null then return null; end if;
  return app.post_reversal(t, p_reason, p_key_prefix || ':' || t.id);
end $$;

revoke all on function app.same_day_charge(uuid), app.post_same_day_charge(uuid), app.reverse_same_day_charge(uuid, text, text)
  from public, anon, authenticated;

create or replace function public.waive_same_day_charge(p_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; v_tx uuid;
begin
  perform app.assert_writable(true);
  select * into r from public.reservations where id = p_id and tenant_id = app.my_tenant();
  if r.id is null then perform app.fail('E_NOT_FOUND', 'Reservation not found.'); end if;
  if not app.can('res.rate.override', r.property_id) then
    perform app.fail('E_FORBIDDEN', 'Only a manager can waive the same-day charge.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  v_tx := app.reverse_same_day_charge(p_id, 'Same-day charge waived: ' || btrim(p_reason), 'waive-same-day');
  if v_tx is null then perform app.fail('E_INVALID', 'There is no same-day charge to waive on this booking.'); end if;
  perform app.log_res(r, 'waive_same_day_charge', p_reason, jsonb_build_object('reversal_id', v_tx));
  return v_tx;
end $$;
revoke all on function public.waive_same_day_charge(uuid, text) from public, anon;
grant execute on function public.waive_same_day_charge(uuid, text) to authenticated;

CREATE OR REPLACE FUNCTION app.do_check_in(p_id uuid, p_room_id uuid, p_registration jsonb, p_room_override_reason text, p_deposit_waive_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.reservations; v_bdate date; v_room uuid; rm public.rooms; v_due numeric; v_reg jsonb; v_stay uuid;
begin
  select * into r from public.reservations where id = p_id for update;
  if r.status not in ('tentative', 'confirmed') then perform app.fail('E_INVALID', 'Only tentative or confirmed bookings can be checked in.'); end if;
  select business_date into v_bdate from public.properties where id = r.property_id;
  if r.arrival_date > v_bdate then perform app.fail('E_INVALID', 'This booking arrives on ' || to_char(r.arrival_date, 'DD Mon YYYY') || '. Change the arrival date first.'); end if;
  if r.departure_date < v_bdate or (r.departure_date = v_bdate and r.arrival_date < v_bdate) then
    perform app.fail('E_INVALID', 'This stay has already ended.'); end if;
  if r.status = 'tentative' and r.hold_until is not null and r.hold_until <= now() then
    perform app.assert_available(r.property_id, r.room_type_id, r.arrival_date, r.departure_date, r.id);
  end if;

  if p_room_id is not null then perform app.set_arrival_room(r, p_room_id); end if;
  select room_id into v_room from public.room_assignments where reservation_id = r.id and is_active limit 1;
  if v_room is null then perform app.fail('E_NO_ROOM', 'Assign a room before check-in.'); end if;
  rm := app.check_arrival_room(r.property_id, v_room, p_room_override_reason);

  v_due := r.deposit_required - app.deposit_paid(r.id);
  if v_due > 0 then
    if coalesce(btrim(p_deposit_waive_reason), '') = '' then
      perform app.fail('E_DEPOSIT_REQUIRED', 'A deposit of ' || to_char(v_due, 'FM999,999,999,990.00') || ' is required before check-in.'); end if;
    if not app.can('fo.deposit.waive', r.property_id) then
      perform app.fail('E_FORBIDDEN', 'Only a manager can waive the deposit.'); end if;
  end if;

  v_reg := app.save_registration(r.guest_id, coalesce(p_registration, '{}'::jsonb));

  insert into public.stays(tenant_id, property_id, reservation_id, room_id, business_date, registration,
    room_override_reason, deposit_waive_reason)
  values (r.tenant_id, r.property_id, r.id, v_room, v_bdate, v_reg,
    case when app.room_ready(rm) then null else btrim(p_room_override_reason) end,
    case when v_due > 0 then btrim(p_deposit_waive_reason) else null end)
  returning id into v_stay;

  update public.rooms set is_occupied = true where id = v_room;
  update public.reservations set status = 'checked_in', hold_until = null, updated_at = now() where id = r.id;
  perform app.log_res(r, 'check_in', null, jsonb_strip_nulls(jsonb_build_object('room_number', rm.room_number,
    'room_override_reason', case when app.room_ready(rm) then null else btrim(p_room_override_reason) end,
    'deposit_waived', case when v_due > 0 then v_due end,
    'deposit_waive_reason', case when v_due > 0 then btrim(p_deposit_waive_reason) end)));
  if r.arrival_date = r.departure_date then perform app.post_same_day_charge(r.id); end if;  -- DAY-006
  return v_stay;
end $function$;

CREATE OR REPLACE FUNCTION public.void_check_in(p_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.reservations; s public.stays; v_bdate date;
begin
  r := app.reservation_for_write(p_id, 'fo.checkin.void');
  if r.status <> 'checked_in' then perform app.fail('E_INVALID', 'Only in-house bookings can have their check-in voided.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  if exists (select 1 from public.stays where reservation_id = p_id and status = 'moved') then
    perform app.fail('E_INVALID', 'This guest has moved rooms, so the check-in cannot be voided.'); end if;
  select * into s from public.stays where reservation_id = p_id and status = 'in_house' for update;
  select business_date into v_bdate from public.properties where id = r.property_id;
  if s.business_date <> v_bdate then perform app.fail('E_INVALID', 'A check-in can only be voided on the day it was made.'); end if;
  perform app.reverse_same_day_charge(p_id, 'Check-in voided: ' || btrim(p_reason), 'void-same-day');
  update public.stays set status = 'voided', checked_out_at = now(), void_reason = btrim(p_reason) where id = s.id;
  update public.rooms set is_occupied = false where id = s.room_id;
  perform set_config('app.audit_reason', btrim(p_reason), true);
  update public.reservations set status = 'confirmed', updated_at = now() where id = p_id;
  perform set_config('app.audit_reason', '', true);
  perform app.log_res(r, 'void_check_in', p_reason, null);
end $function$;

-- Same-day arrivals appear on the arrivals list.
create or replace view public.v_arrivals with (security_invoker = true) as
SELECT r.id,
    r.property_id,
    r.number,
    r.guest_id,
    NULLIF(btrim(((COALESCE(g.first_name, ''::text) || ' '::text) || COALESCE(g.last_name, ''::text))), ''::text) AS guest_name,
    g.phone AS guest_phone,
    r.arrival_date,
    r.departure_date,
    (r.departure_date - r.arrival_date) AS nights,
    r.adults,
    r.children,
    r.room_type_id,
    rt.code AS room_type_code,
    rt.name AS room_type_name,
    r.rate_plan_id,
    r.status,
    r.hold_until,
    r.company_name,
    r.special_requests,
    r.total_amount,
    r.currency,
    r.deposit_required,
    app.deposit_paid(r.id) AS deposit_paid,
    a.room_id,
    rm.room_number,
    rm.condition AS room_condition,
    rm.is_occupied AS room_is_occupied,
    ((rm.id IS NOT NULL) AND rm.is_active AND (rm.condition = ANY (ARRAY['clean'::text, 'inspected'::text])) AND (NOT rm.is_occupied)) AS room_is_ready,
    (r.arrival_date < p.business_date) AS is_late,
    GREATEST((r.deposit_required - app.deposit_paid(r.id)), (0)::numeric) AS deposit_due
   FROM (((((reservations r
     JOIN properties p ON ((p.id = r.property_id)))
     JOIN room_types rt ON ((rt.id = r.room_type_id)))
     LEFT JOIN guests g ON ((g.id = r.guest_id)))
     LEFT JOIN LATERAL ( SELECT x.room_id
           FROM room_assignments x
          WHERE ((x.reservation_id = r.id) AND x.is_active)
         LIMIT 1) a ON (true))
     LEFT JOIN rooms rm ON ((rm.id = a.room_id)))
  WHERE ((r.status = ANY (ARRAY['tentative'::text, 'confirmed'::text])) AND (r.arrival_date <= p.business_date) AND ((r.departure_date > p.business_date) OR ((r.departure_date = p.business_date) AND (r.arrival_date = p.business_date))));

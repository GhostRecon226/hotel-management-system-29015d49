-- Money figures the screens show come from the database (status report S9, Peter's adjustment 4).
--
-- Before: several screens added up or subtracted money in the browser: the check-out total, the deposit
-- due, the Post charge total, the Cancel / No-show fee preview (which ignored the free-cancellation
-- window and showed a fee the database would not charge), and the dashboard's 30-day occupancy, ADR
-- and RevPAR. Browser sums can drift from the ledger by rounding and can miss rules.
-- After: each figure is calculated here and the screens show it as it is.
--   preview_charge          net, tax and total for the Post charge form (same maths as post_charge)
--   preview_reservation_fee the fee Cancel or No-show would charge (same rule as the actions)
--   checkout_outstanding    what must be settled before check-out, across the booking's folios
--   kpi_summary             occupancy, ADR and RevPAR over a period, same definitions as v_kpi_daily
--   v_folio_balances        + amount_due, credit
--   v_arrivals              + deposit_due
--   v_maintenance_tickets   + has_approved_block ("Room blocked" only once a block is approved)
-- Also fixes decision 6d: a rate plan with 0 free-cancellation days now charges however early the
-- cancellation (the previous rule made every future cancellation free when the setting was 0).

-- One fee rule for cancelling, marking a no-show, the nightly roll and the previews.
create or replace function app.reservation_fee(p_res uuid, p_kind text)
returns numeric language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r public.reservations; rp public.rate_plans; v_bdate date;
begin
  select * into r from public.reservations where id = p_res;
  select * into rp from public.rate_plans where id = r.rate_plan_id;
  if p_kind = 'cancel' then
    select business_date into v_bdate from public.properties where id = r.property_id;
    if coalesce(rp.cancellation_free_days, 0) > 0 and r.arrival_date - v_bdate >= rp.cancellation_free_days then return 0; end if;
    return app.policy_amount(rp.cancellation_policy_type, rp.cancellation_policy_value, p_res);
  elsif p_kind = 'no_show' then
    return app.policy_amount(rp.no_show_policy_type, rp.no_show_policy_value, p_res);
  end if;
  perform app.fail('E_INVALID', 'Unknown fee kind.');
end $$;
revoke all on function app.reservation_fee(uuid, text) from public, anon, authenticated;

create or replace function public.preview_reservation_fee(p_id uuid, p_kind text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r public.reservations; rp public.rate_plans; v_fee numeric;
begin
  select * into r from public.reservations where id = p_id and tenant_id = app.my_tenant();
  if r.id is null then perform app.fail('E_NOT_FOUND', 'Reservation not found.'); end if;
  if not app.can('res.view', r.property_id) then perform app.fail('E_FORBIDDEN', 'You do not have permission to view bookings.'); end if;
  select * into rp from public.rate_plans where id = r.rate_plan_id;
  v_fee := app.reservation_fee(p_id, p_kind);
  return jsonb_build_object('fee', v_fee, 'currency', r.currency, 'free', v_fee = 0,
    'free_days', case when p_kind = 'cancel' then rp.cancellation_free_days end, 'rate_plan', rp.name);
end $$;

create or replace function public.preview_charge(p_property_id uuid, p_amount numeric, p_tax_inclusive boolean)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_cur text; v_amt numeric; v_tax numeric; v_net numeric; v_lines jsonb;
begin
  if app.my_tenant() is null or not app.has_property_access(p_property_id) then
    perform app.fail('E_FORBIDDEN', 'You do not have access to this property.'); end if;
  select base_currency into v_cur from public.properties where id = p_property_id;
  perform app.assert_money(p_amount, v_cur);
  v_amt := round(coalesce(p_amount, 0), 2);
  select coalesce(sum(t.amount), 0),
         coalesce(jsonb_agg(jsonb_build_object('name', t.tax_name, 'percent', t.percent, 'amount', t.amount) order by t.line_no), '[]'::jsonb)
    into v_tax, v_lines
  from public.calculate_tax(p_property_id, v_amt, coalesce(p_tax_inclusive, false)) t;
  v_net := case when coalesce(p_tax_inclusive, false) then v_amt - v_tax else v_amt end;
  return jsonb_build_object('net', v_net, 'tax', v_tax, 'total', v_net + v_tax, 'currency', v_cur, 'lines', v_lines);
end $$;

create or replace function public.checkout_outstanding(p_reservation_id uuid)
returns numeric language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r public.reservations;
begin
  select * into r from public.reservations where id = p_reservation_id and tenant_id = app.my_tenant();
  if r.id is null or not app.folio_scope_ok(r.property_id, r.id) then perform app.fail('E_NOT_FOUND', 'Reservation not found.'); end if;
  return app.reservation_outstanding(p_reservation_id);
end $$;

create or replace function public.kpi_summary(p_property_id uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_sold bigint; v_avail bigint; v_rev numeric;
begin
  if app.my_tenant() is null or not (app.can('rpt.operations.view', p_property_id) or app.can('rpt.finance.view', p_property_id)) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to view these figures.'); end if;
  select coalesce(sum(rooms_sold), 0), coalesce(sum(rooms_available), 0), coalesce(sum(room_revenue), 0)
    into v_sold, v_avail, v_rev
  from public.daily_stats where property_id = p_property_id and business_date between p_from and p_to;
  return jsonb_build_object('rooms_sold', v_sold, 'rooms_available', v_avail, 'room_revenue', v_rev,
    'occupancy', round(v_sold::numeric / nullif(v_avail, 0), 4),
    'adr', round(v_rev / nullif(v_sold, 0), 2),
    'revpar', round(v_rev / nullif(v_avail, 0), 2),
    'days', (select count(*) from public.daily_stats where property_id = p_property_id and business_date between p_from and p_to));
end $$;

revoke all on function public.preview_reservation_fee(uuid, text), public.preview_charge(uuid, numeric, boolean),
  public.checkout_outstanding(uuid), public.kpi_summary(uuid, date, date) from public, anon;
grant execute on function public.preview_reservation_fee(uuid, text), public.preview_charge(uuid, numeric, boolean),
  public.checkout_outstanding(uuid), public.kpi_summary(uuid, date, date) to authenticated, service_role;

create or replace view public.v_folio_balances with (security_invoker = true) as
 SELECT f.id AS folio_id,
    f.property_id,
    f.reservation_id,
    r.number AS reservation_number,
    f.number,
    f.label,
    f.is_main,
    f.status,
    f.currency,
    f.guest_id,
    NULLIF(btrim(((COALESCE(g.first_name, ''::text) || ' '::text) || COALESCE(g.last_name, ''::text))), ''::text) AS guest_name,
    r.arrival_date,
    r.departure_date,
    r.status AS reservation_status,
    rm.room_number,
    f.closed_at,
    f.created_at,
    COALESCE(sum(v.total) FILTER (WHERE (v.total > (0)::numeric)), (0)::numeric) AS total_debits,
    COALESCE((- sum(v.total) FILTER (WHERE (v.total < (0)::numeric))), (0)::numeric) AS total_credits,
    COALESCE(sum(v.total), (0)::numeric) AS balance,
    GREATEST(COALESCE(sum(v.total), (0)::numeric), (0)::numeric) AS amount_due,
    GREATEST((- COALESCE(sum(v.total), (0)::numeric)), (0)::numeric) AS credit
   FROM (((((folios f
     JOIN reservations r ON ((r.id = f.reservation_id)))
     LEFT JOIN guests g ON ((g.id = f.guest_id)))
     LEFT JOIN LATERAL ( SELECT s.room_id
           FROM stays s
          WHERE ((s.reservation_id = r.id) AND (s.status = ANY (ARRAY['in_house'::text, 'checked_out'::text])))
          ORDER BY s.checked_in_at DESC
         LIMIT 1) st ON (true))
     LEFT JOIN rooms rm ON ((rm.id = st.room_id)))
     LEFT JOIN v_folio_transactions v ON ((v.folio_id = f.id)))
  GROUP BY f.id, r.number, g.first_name, g.last_name, r.arrival_date, r.departure_date, r.status, rm.room_number;

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
  WHERE ((r.status = ANY (ARRAY['tentative'::text, 'confirmed'::text])) AND (r.arrival_date <= p.business_date) AND (r.departure_date > p.business_date));

create or replace view public.v_maintenance_tickets with (security_invoker = true) as
 SELECT t.id,
    t.tenant_id,
    t.property_id,
    t.title,
    t.description,
    t.room_id,
    t.location,
    t.priority,
    t.status,
    t.assignee_id,
    t.wait_reason,
    t.resolution,
    t.resolved_by,
    t.resolved_at,
    t.closed_by,
    t.closed_at,
    t.cancel_reason,
    t.reopen_count,
    t.last_reopen_reason,
    t.business_date,
    t.created_by,
    t.created_at,
    t.updated_at,
    r.room_number,
    pa.full_name AS assignee_name,
    pr.full_name AS resolved_by_name,
    pcl.full_name AS closed_by_name,
    pcr.full_name AS created_by_name,
    (EXISTS ( SELECT 1
           FROM room_blocks b
          WHERE ((b.ticket_id = t.id) AND (b.status = ANY (ARRAY['pending'::text, 'approved'::text]))))) AS has_active_block,
    (EXISTS ( SELECT 1 FROM room_blocks b2 WHERE ((b2.ticket_id = t.id) AND (b2.status = 'approved'::text)))) AS has_approved_block
   FROM (((((maintenance_tickets t
     LEFT JOIN rooms r ON ((r.id = t.room_id)))
     LEFT JOIN profiles pa ON ((pa.id = t.assignee_id)))
     LEFT JOIN profiles pr ON ((pr.id = t.resolved_by)))
     LEFT JOIN profiles pcl ON ((pcl.id = t.closed_by)))
     LEFT JOIN profiles pcr ON ((pcr.id = t.created_by)));

-- The actions use the shared fee rule.
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
  v_fee := app.reservation_fee(p_id, 'cancel');
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
  v_fee := app.reservation_fee(p_id, 'no_show');
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

CREATE OR REPLACE FUNCTION app.roll_no_shows(p properties, p_date date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.reservations; rp public.rate_plans; v_n int := 0; v_fee numeric;
begin
  for r in select * from public.reservations where property_id = p.id and status = 'confirmed' and arrival_date <= p_date for update loop
    select * into rp from public.rate_plans where id = r.rate_plan_id;
    v_fee := app.reservation_fee(r.id, 'no_show');
    perform app.release_rooms(r.id);
    update public.reservations set status = 'no_show', no_show_fee = v_fee, fee_waived = false,
      status_reason = 'Did not arrive (marked at business date roll)', hold_until = null, updated_at = now() where id = r.id;
    perform app.log_res(r, 'auto_no_show', 'Marked at business date roll', jsonb_build_object('fee', v_fee));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $function$;

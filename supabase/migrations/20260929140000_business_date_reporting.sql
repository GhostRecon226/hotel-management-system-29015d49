-- Business date roll, daily statistics and reports.
create extension if not exists pg_cron;

alter table public.properties add column if not exists rollover_time time not null default '03:00';

-- Only the roll may change the business date.
create or replace function app.protect_business_date()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.business_date is distinct from old.business_date and coalesce(current_setting('app.rolling', true), '') <> 'on' then
    perform app.fail('E_INVALID', 'The business date changes only through the daily roll.');
  end if;
  return new;
end $$;
create trigger properties_protect_business_date before update of business_date on public.properties
  for each row execute function app.protect_business_date();

create table public.business_date_log (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  from_date   date not null,
  to_date     date not null,
  status      text not null check (status in ('success', 'failed')),
  trigger     text not null check (trigger in ('schedule', 'manual')),
  actor_id    uuid,
  started_at  timestamptz not null,
  finished_at timestamptz not null default now(),
  details     jsonb not null default '{}'::jsonb,
  error       text
);
create unique index business_date_log_once on public.business_date_log(property_id, from_date) where status = 'success';
create index business_date_log_property_idx on public.business_date_log(property_id, finished_at desc);
grant select on public.business_date_log to authenticated;
grant all on public.business_date_log to service_role;
alter table public.business_date_log enable row level security;
create policy "Managers read roll log" on public.business_date_log for select to authenticated
  using (tenant_id = app.my_tenant() and (app.can('fin.nightaudit.run', property_id) or app.can('rpt.operations.view', property_id) or app.can('adm.audit.view', property_id)));

create table public.daily_stats (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  property_id     uuid not null references public.properties(id) on delete cascade,
  business_date   date not null,
  rooms_available integer not null default 0,
  rooms_sold      integer not null default 0,
  room_revenue    numeric(20,4) not null default 0,
  total_revenue   numeric(20,4) not null default 0,
  arrivals        integer not null default 0,
  departures      integer not null default 0,
  no_shows        integer not null default 0,
  cancellations   integer not null default 0,
  computed_at     timestamptz not null default now(),
  unique (property_id, business_date)
);
grant select on public.daily_stats to authenticated;
grant all on public.daily_stats to service_role;
alter table public.daily_stats enable row level security;
create policy "Report users read daily stats" on public.daily_stats for select to authenticated
  using (tenant_id = app.my_tenant() and (app.can('rpt.operations.view', property_id) or app.can('rpt.finance.view', property_id)));

create unique index hk_tasks_one_stayover on public.hk_tasks(stay_id, business_date) where type = 'stayover' and status <> 'cancelled';

-- Statistics ------------------------------------------------------------------
create or replace function app.compute_daily_stats(p_property uuid, p_date date)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.properties;
begin
  select * into p from public.properties where id = p_property;
  insert into public.daily_stats as d(tenant_id, property_id, business_date, rooms_available, rooms_sold, room_revenue, total_revenue,
    arrivals, departures, no_shows, cancellations, computed_at)
  select p.tenant_id, p.id, p_date,
    (select count(*) from public.rooms r where r.property_id = p.id and r.is_active
       and not exists (select 1 from public.room_blocks b where b.room_id = r.id and b.status = 'approved'
         and b.block_type in ('out_of_order', 'out_of_service') and b.from_date <= p_date and b.to_date > p_date)),
    (select count(*) from public.reservation_nights n join public.reservations r on r.id = n.reservation_id
       where n.property_id = p.id and n.stay_date = p_date and r.status in ('checked_in', 'checked_out')),
    (select coalesce(sum(t.base_amount), 0) from public.folio_transactions t join public.charge_codes c on c.id = t.charge_code_id
       where t.property_id = p.id and t.business_date = p_date and c.category = 'room' and t.kind not in ('payment', 'refund')),
    (select coalesce(sum(t.base_amount), 0) from public.folio_transactions t join public.charge_codes c on c.id = t.charge_code_id
       where t.property_id = p.id and t.business_date = p_date and c.category <> 'tax' and t.kind not in ('payment', 'refund')),
    (select count(*) from public.stays s where s.property_id = p.id and s.business_date = p_date and s.status <> 'voided'
       and not exists (select 1 from public.stays s2 where s2.reservation_id = s.reservation_id and s2.checked_in_at < s.checked_in_at)),
    (select count(*) from public.stays s where s.property_id = p.id and s.checkout_business_date = p_date and s.status = 'checked_out'),
    (select count(*) from public.reservations r where r.property_id = p.id and r.status = 'no_show' and r.arrival_date = p_date),
    (select count(*) from public.reservations r where r.property_id = p.id and r.status = 'cancelled'
       and (r.cancelled_at at time zone p.timezone)::date = p_date),
    now()
  on conflict (property_id, business_date) do update set rooms_available = excluded.rooms_available, rooms_sold = excluded.rooms_sold,
    room_revenue = excluded.room_revenue, total_revenue = excluded.total_revenue, arrivals = excluded.arrivals,
    departures = excluded.departures, no_shows = excluded.no_shows, cancellations = excluded.cancellations, computed_at = now();
end $$;

create or replace view public.v_kpi_daily with (security_invoker = true) as
select d.property_id, d.business_date, d.rooms_available, d.rooms_sold, d.room_revenue, d.total_revenue,
  d.arrivals, d.departures, d.no_shows, d.cancellations,
  round(d.rooms_sold::numeric / nullif(d.rooms_available, 0), 4) as occupancy,
  round(d.room_revenue / nullif(d.rooms_sold, 0), 2) as adr,
  round(d.room_revenue / nullif(d.rooms_available, 0), 2) as revpar
from public.daily_stats d;
grant select on public.v_kpi_daily to authenticated;

-- Roll steps (each idempotent) ------------------------------------------------
create or replace function app.roll_room_charges(p public.properties, p_date date)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
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
    delete from _roll_tax;
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
end $$;

create or replace function app.roll_expire_holds(p public.properties)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; v_n int := 0;
begin
  for r in select * from public.reservations where property_id = p.id and status = 'tentative'
      and hold_until is not null and hold_until < now() for update loop
    perform app.release_rooms(r.id);
    update public.reservations set status = 'cancelled', status_reason = 'Hold expired without confirmation',
      cancelled_at = now(), hold_until = null, updated_at = now() where id = r.id;
    perform app.log_res(r, 'hold_expired', 'Hold expired at business date roll');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

create or replace function app.roll_no_shows(p public.properties, p_date date)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; rp public.rate_plans; v_n int := 0; v_fee numeric;
begin
  for r in select * from public.reservations where property_id = p.id and status = 'confirmed' and arrival_date <= p_date for update loop
    select * into rp from public.rate_plans where id = r.rate_plan_id;
    v_fee := app.policy_amount(rp.no_show_policy_type, rp.no_show_policy_value, r.id);
    perform app.release_rooms(r.id);
    update public.reservations set status = 'no_show', no_show_fee = v_fee, fee_waived = false,
      status_reason = 'Did not arrive (marked at business date roll)', hold_until = null, updated_at = now() where id = r.id;
    perform app.log_res(r, 'auto_no_show', 'Marked at business date roll', jsonb_build_object('fee', v_fee));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

create or replace function app.roll_stayovers(p public.properties, p_new_date date)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_n int;
begin
  insert into public.hk_tasks(tenant_id, property_id, room_id, stay_id, type, priority, checklist, business_date, notes)
  select st.tenant_id, st.property_id, st.room_id, st.id, 'stayover', 'normal', app.hk_default_checklist('stayover'), p_new_date,
    'Created by business date roll'
  from public.stays st join public.reservations r on r.id = st.reservation_id
  where st.property_id = p.id and st.status = 'in_house' and r.departure_date > p_new_date
    and not exists (select 1 from public.hk_tasks t where t.stay_id = st.id and t.type = 'stayover'
      and t.business_date = p_new_date and t.status <> 'cancelled');
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function app.rollover_due(p public.properties)
returns boolean language sql stable as $$
  select (now() at time zone p.timezone) >= ((p.business_date + 1)::timestamp + p.rollover_time)
$$;

-- One roll for one property. All steps run in a sub-transaction: any error undoes them all.
create or replace function app.roll_property(p_property uuid, p_trigger text, p_actor uuid default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.properties; v_started timestamptz := clock_timestamp(); v_details jsonb; v_err text; v_last text;
  v_charges int; v_expired int; v_noshows int; v_stay int;
begin
  select * into p from public.properties where id = p_property for update skip locked;
  if p.id is null then return jsonb_build_object('property_id', p_property, 'status', 'busy'); end if;
  begin
    perform set_config('app.settlement', 'on', true);
    perform set_config('app.rolling', 'on', true);
    v_charges := app.roll_room_charges(p, p.business_date);
    v_expired := app.roll_expire_holds(p);
    v_noshows := app.roll_no_shows(p, p.business_date);
    update public.properties set business_date = p.business_date + 1 where id = p.id;
    v_stay := app.roll_stayovers(p, p.business_date + 1);
    perform app.compute_daily_stats(p.id, p.business_date);
    v_details := jsonb_build_object('room_charges', v_charges, 'holds_expired', v_expired, 'no_shows', v_noshows, 'stayover_tasks', v_stay);
    insert into public.business_date_log(tenant_id, property_id, from_date, to_date, status, trigger, actor_id, started_at, details)
    values (p.tenant_id, p.id, p.business_date, p.business_date + 1, 'success', p_trigger, p_actor, v_started, v_details);
    perform set_config('app.rolling', '', true);
    perform set_config('app.settlement', '', true);
  exception when others then
    get stacked diagnostics v_err = message_text;
    select status into v_last from public.business_date_log where property_id = p.id order by finished_at desc limit 1;
    insert into public.business_date_log(tenant_id, property_id, from_date, to_date, status, trigger, actor_id, started_at, error)
    values (p.tenant_id, p.id, p.business_date, p.business_date + 1, 'failed', p_trigger, p_actor, v_started, v_err);
    if v_last is distinct from 'failed' then
      insert into public.notifications(tenant_id, property_id, user_id, kind, title, body, link)
      select distinct p.tenant_id, p.id, upr.user_id, 'rollover_failed', 'Business date roll failed',
        p.name || ': ' || regexp_replace(v_err, '^\[[A-Z0-9_]+\]\s*', ''), '/admin'
      from public.user_property_roles upr
      join public.role_permissions rp on rp.role_id = upr.role_id and rp.permission_key = 'fin.nightaudit.run'
      join public.profiles pr on pr.id = upr.user_id and pr.status = 'active'
      where upr.property_id = p.id;
    end if;
    return jsonb_build_object('property_id', p.id, 'status', 'failed', 'error', v_err);
  end;
  return jsonb_build_object('property_id', p.id, 'status', 'success', 'from_date', p.business_date) || v_details;
end $$;

-- Rolls every property whose roll time has passed. At most 7 days per property per run.
create or replace function app.run_due_rollovers(p_tenant uuid default null, p_trigger text default 'schedule', p_actor uuid default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.properties; v_res jsonb; v_out jsonb := '[]'::jsonb; i int;
begin
  for p in select * from public.properties where (p_tenant is null or tenant_id = p_tenant) order by id loop
    for i in 1..7 loop
      select * into p from public.properties where id = p.id;
      exit when not app.rollover_due(p);
      v_res := app.roll_property(p.id, p_trigger, p_actor);
      v_out := v_out || jsonb_build_array(v_res);
      exit when v_res->>'status' <> 'success';
    end loop;
  end loop;
  return v_out;
end $$;

-- Public functions -------------------------------------------------------------
create or replace function public.run_due_rollovers_now()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.properties p where p.tenant_id = app.my_tenant() and app.can('fin.nightaudit.run', p.id)) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to run the business date roll.'); end if;
  return app.run_due_rollovers(app.my_tenant(), 'manual', auth.uid());
end $$;

create or replace function public.set_rollover_time(p_property_id uuid, p_time time)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.require('fin.nightaudit.run', p_property_id);
  if p_time is null then perform app.fail('E_REQUIRED', 'Choose a time.'); end if;
  update public.properties set rollover_time = p_time where id = p_property_id and tenant_id = app.my_tenant();
end $$;

create or replace function public.rollover_status(p_property_id uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('business_date', p.business_date, 'rollover_time', p.rollover_time, 'timezone', p.timezone,
    'next_roll_at', ((p.business_date + 1)::timestamp + p.rollover_time), 'is_due', app.rollover_due(p))
  from public.properties p where p.id = p_property_id and p.tenant_id = app.my_tenant() and app.has_property_access(p.id)
$$;

create or replace function public.dashboard_summary(p_property_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare p public.properties;
begin
  select * into p from public.properties where id = p_property_id and tenant_id = app.my_tenant();
  if p.id is null or not app.has_property_access(p.id) then perform app.fail('E_NOT_FOUND', 'Property not found.'); end if;
  return jsonb_build_object(
    'business_date', p.business_date,
    'arrivals', (select count(*) from public.reservations r where r.property_id = p.id and r.arrival_date = p.business_date
       and r.status in ('tentative', 'confirmed', 'checked_in')),
    'arrivals_pending', (select count(*) from public.reservations r where r.property_id = p.id and r.arrival_date = p.business_date
       and r.status in ('tentative', 'confirmed')),
    'departures', (select count(*) from public.reservations r where r.property_id = p.id and r.departure_date = p.business_date
       and r.status in ('checked_in', 'checked_out')),
    'departures_pending', (select count(*) from public.reservations r where r.property_id = p.id and r.departure_date = p.business_date
       and r.status = 'checked_in'),
    'in_house', (select count(*) from public.stays s where s.property_id = p.id and s.status = 'in_house'),
    'vacant_clean', (select count(*) from public.rooms r where r.property_id = p.id and r.is_active and not r.is_occupied
       and r.condition in ('clean', 'inspected') and not app.room_blocked_today(r.id, p.business_date)),
    'vacant_dirty', (select count(*) from public.rooms r where r.property_id = p.id and r.is_active and not r.is_occupied
       and r.condition = 'dirty' and not app.room_blocked_today(r.id, p.business_date)),
    'out_of_order', (select count(*) from public.rooms r where r.property_id = p.id and r.is_active
       and (r.condition = 'out_of_order' or app.room_blocked_today(r.id, p.business_date))),
    'pending_approvals', (select count(*) from public.approvals a where a.property_id = p.id and a.status = 'pending'),
    'open_tickets', (select count(*) from public.maintenance_tickets t where t.property_id = p.id
       and t.status in ('open', 'assigned', 'in_progress', 'waiting')),
    'urgent_tickets', (select count(*) from public.maintenance_tickets t where t.property_id = p.id
       and t.status in ('open', 'assigned', 'in_progress', 'waiting') and t.priority = 'urgent'));
end $$;

create or replace function app.room_blocked_today(p_room uuid, p_date date)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.room_blocks b where b.room_id = p_room and b.status = 'approved'
    and b.block_type in ('out_of_order', 'out_of_service') and b.from_date <= p_date and b.to_date > p_date)
$$;

create or replace function app.require_report(p_perm text, p_property uuid)
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.properties where id = p_property and tenant_id = app.my_tenant()) or not app.can(p_perm, p_property) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to view this report.'); end if;
end $$;

create or replace function public.report_revenue_by_charge_code(p_property_id uuid, p_from date, p_to date)
returns table(charge_code text, name text, category text, net numeric, tax numeric, gross numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform app.require_report('rpt.finance.view', p_property_id);
  return query
  select c.code, c.name, c.category, coalesce(sum(t.base_amount), 0)::numeric,
    coalesce(sum((select sum(l.base_amount) from public.folio_tax_lines l where l.transaction_id = t.id)), 0)::numeric,
    (coalesce(sum(t.base_amount), 0) + coalesce(sum((select sum(l.base_amount) from public.folio_tax_lines l where l.transaction_id = t.id)), 0))::numeric
  from public.folio_transactions t join public.charge_codes c on c.id = t.charge_code_id
  where t.property_id = p_property_id and t.business_date between p_from and p_to and t.kind not in ('payment', 'refund')
  group by c.code, c.name, c.category
  having coalesce(sum(t.base_amount), 0) <> 0
  order by 6 desc;
end $$;

create or replace function public.report_outstanding_balances(p_property_id uuid)
returns table(folio_id uuid, folio_number text, label text, reservation_id uuid, reservation_number text, guest_name text,
  room_number text, reservation_status text, folio_status text, departure_date date, currency char(3), balance numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform app.require_report('rpt.finance.view', p_property_id);
  return query
  select b.folio_id, b.number, b.label, b.reservation_id, b.reservation_number, b.guest_name, b.room_number, b.reservation_status,
    b.status, b.departure_date, b.currency, b.balance::numeric
  from public.v_folio_balances b where b.property_id = p_property_id and b.balance <> 0
  order by b.balance desc;
end $$;

create or replace function public.report_payments(p_property_id uuid, p_from date, p_to date)
returns table(business_date date, method text, kind text, payments numeric, refunds numeric, net numeric, count bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform app.require_report('rpt.finance.view', p_property_id);
  return query
  select t.business_date, coalesce(m.name, 'Other'), coalesce(m.kind, 'other'),
    coalesce(-sum(t.base_amount) filter (where t.kind = 'payment'), 0)::numeric,
    coalesce(sum(t.base_amount) filter (where t.kind = 'refund'), 0)::numeric,
    (-coalesce(sum(t.base_amount), 0))::numeric, count(*)
  from public.folio_transactions t left join public.payment_methods m on m.id = t.payment_method_id
  where t.property_id = p_property_id and t.business_date between p_from and p_to and t.kind in ('payment', 'refund')
  group by t.business_date, m.name, m.kind
  order by t.business_date desc, 2;
end $$;

revoke all on function app.protect_business_date(), app.compute_daily_stats(uuid, date), app.roll_room_charges(public.properties, date),
  app.roll_expire_holds(public.properties), app.roll_no_shows(public.properties, date), app.roll_stayovers(public.properties, date),
  app.rollover_due(public.properties), app.roll_property(uuid, text, uuid), app.run_due_rollovers(uuid, text, uuid),
  app.room_blocked_today(uuid, date), app.require_report(text, uuid) from public;
revoke all on function public.run_due_rollovers_now(), public.set_rollover_time(uuid, time), public.rollover_status(uuid),
  public.dashboard_summary(uuid), public.report_revenue_by_charge_code(uuid, date, date), public.report_outstanding_balances(uuid),
  public.report_payments(uuid, date, date) from public, anon;
grant execute on function public.run_due_rollovers_now(), public.set_rollover_time(uuid, time), public.rollover_status(uuid),
  public.dashboard_summary(uuid), public.report_revenue_by_charge_code(uuid, date, date), public.report_outstanding_balances(uuid),
  public.report_payments(uuid, date, date) to authenticated;

-- Cashier shifts and night audit flags (FIN-016, DAY-005).
--
-- A cashier opens a shift with a float. Every payment, refund and reversal that cashier posts is tied to the shift.
-- At the end the cashier counts each payment method; the database works out what the drawer should hold and the
-- difference. A manager reconciles the shift (never the person who closed it). Before the night audit, the flags
-- list what is still open. The flags do not stop the date from rolling: that gate stays off for now (DAY-005 part 2).
--
-- Permissions: fin.shift.close already exists and opens and closes your own shift. fin.shift.reconcile is new and
-- goes to the built-in System Administrator, General Manager, Front Office Manager and Accountant roles only.
-- Custom roles copied earlier do not get it.

alter table public.properties add column require_cashier_shift boolean not null default false;

create table public.cashier_shifts (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  property_id       uuid not null references public.properties(id) on delete cascade,
  user_id           uuid not null references public.profiles(id),
  idempotency_key   text not null,
  status            text not null default 'open' check (status in ('open', 'closed')),
  business_date     date not null,
  opening_float     numeric(20,4) not null default 0 check (opening_float >= 0),
  opened_at         timestamptz not null default now(),
  closed_at         timestamptz,
  closed_by         uuid,
  close_note        text,
  variance_total    numeric(20,4),
  reconciled_at     timestamptz,
  reconciled_by     uuid,
  reconcile_note    text,
  unique (tenant_id, idempotency_key),
  constraint cashier_shifts_sod check (reconciled_by is null or closed_by is null or reconciled_by <> closed_by)
);
create unique index cashier_shifts_one_open on public.cashier_shifts(user_id, property_id) where status = 'open';
create index cashier_shifts_property_idx on public.cashier_shifts(property_id, business_date desc);

create table public.cashier_shift_lines (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  property_id        uuid not null references public.properties(id) on delete cascade,
  shift_id           uuid not null references public.cashier_shifts(id) on delete cascade,
  payment_method_id  uuid not null references public.payment_methods(id),
  expected           numeric(20,4) not null,
  counted            numeric(20,4) not null check (counted >= 0),
  variance           numeric(20,4) not null,
  unique (shift_id, payment_method_id)
);

alter table public.cashier_shifts enable row level security;
alter table public.cashier_shift_lines enable row level security;
create policy cashier_shifts_read on public.cashier_shifts for select to authenticated
  using (tenant_id = app.my_tenant() and (user_id = auth.uid() or app.can('fin.shift.reconcile', property_id)));
create policy cashier_shift_lines_read on public.cashier_shift_lines for select to authenticated
  using (tenant_id = app.my_tenant() and exists (select 1 from public.cashier_shifts s where s.id = shift_id));
grant select on public.cashier_shifts, public.cashier_shift_lines to authenticated;
create trigger cashier_shifts_enforce_writable before insert or update or delete on public.cashier_shifts
  for each row execute function app.enforce_writable();
create trigger cashier_shift_lines_enforce_writable before insert or update or delete on public.cashier_shift_lines
  for each row execute function app.enforce_writable();

-- Ledger rows keep which shift took them. Set by a trigger at insert, so no money function changes.
alter table public.folio_transactions add column cashier_shift_id uuid references public.cashier_shifts(id);
create index folio_tx_shift_idx on public.folio_transactions(cashier_shift_id) where cashier_shift_id is not null;

create or replace function app.stamp_cashier_shift()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_shift uuid;
begin
  if new.payment_method_id is null or new.kind not in ('payment', 'refund', 'reversal') or auth.uid() is null then
    return new;
  end if;
  select id into v_shift from public.cashier_shifts
   where user_id = auth.uid() and property_id = new.property_id and status = 'open';
  if v_shift is null and new.kind = 'payment'
     and (select require_cashier_shift from public.properties where id = new.property_id) then
    perform app.fail('E_NO_SHIFT', 'Open your cashier shift before taking payments.');
  end if;
  new.cashier_shift_id := v_shift;
  return new;
end $$;
create trigger folio_transactions_stamp_shift before insert on public.folio_transactions
  for each row execute function app.stamp_cashier_shift();

-- New permission, built-in roles only.
insert into public.permissions(key, description, module) values ('fin.shift.reconcile', 'Reconcile cashier shifts', 'finance')
on conflict (key) do nothing;
insert into public.role_permissions(role_id, permission_key, grant_level)
select r.id, 'fin.shift.reconcile', 'Y' from public.roles r where r.tenant_id is null and r.code in ('SYSADMIN', 'GM', 'FOM', 'ACCT')
on conflict do nothing;

-- What a shift should hold, per payment method: cash starts with the float. Payments count in, refunds and
-- reversals count out. Amounts are in the hotel's base currency.
create or replace function app.shift_expected(p_shift uuid)
returns table (payment_method_id uuid, method_name text, method_kind text, expected numeric)
language sql stable security definer set search_path = public, pg_temp as $$
  select pm.id, pm.name, pm.kind,
         round(coalesce(-sum(ft.base_amount), 0) + case when pm.kind = 'cash' then s.opening_float else 0 end, 2)
  from public.cashier_shifts s
  join public.payment_methods pm on pm.property_id = s.property_id
  left join public.folio_transactions ft on ft.cashier_shift_id = s.id and ft.payment_method_id = pm.id
                                        and ft.kind in ('payment', 'refund', 'reversal')
  where s.id = p_shift
  group by pm.id, pm.name, pm.kind, s.opening_float
  having coalesce(-sum(ft.base_amount), 0) <> 0 or pm.kind = 'cash'
  order by pm.kind <> 'cash', pm.name
$$;
revoke all on function app.shift_expected(uuid) from public, anon, authenticated;

create or replace function app.shift_json(p_shift uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare s public.cashier_shifts;
begin
  select * into s from public.cashier_shifts where id = p_shift;
  return jsonb_build_object(
    'id', s.id, 'status', s.status, 'property_id', s.property_id, 'business_date', s.business_date,
    'cashier_id', s.user_id, 'cashier_name', (select full_name from public.profiles where id = s.user_id),
    'opening_float', round(s.opening_float, 2), 'opened_at', s.opened_at, 'closed_at', s.closed_at,
    'close_note', s.close_note, 'variance_total', round(s.variance_total, 2),
    'reconciled_at', s.reconciled_at, 'reconciled_by_name', (select full_name from public.profiles where id = s.reconciled_by),
    'reconcile_note', s.reconcile_note,
    'lines', coalesce(case when s.status = 'open' then
        (select jsonb_agg(jsonb_build_object('payment_method_id', e.payment_method_id, 'method_name', e.method_name,
           'method_kind', e.method_kind, 'expected', e.expected, 'counted', null, 'variance', null))
         from app.shift_expected(s.id) e)
      else
        (select jsonb_agg(jsonb_build_object('payment_method_id', l.payment_method_id, 'method_name', pm.name,
           'method_kind', pm.kind, 'expected', round(l.expected, 2), 'counted', round(l.counted, 2), 'variance', round(l.variance, 2))
           order by pm.kind <> 'cash', pm.name)
         from public.cashier_shift_lines l join public.payment_methods pm on pm.id = l.payment_method_id where l.shift_id = s.id)
      end, '[]'::jsonb));
end $$;
revoke all on function app.shift_json(uuid) from public, anon, authenticated;

-- Opens the caller's shift. A retry with the same key returns the same shift.
create or replace function public.open_cashier_shift(p_property_id uuid, p_opening_float numeric, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_key text := btrim(coalesce(p_idempotency_key, '')); v_float numeric := coalesce(p_opening_float, 0); v_id uuid; v_tenant uuid;
begin
  perform app.require('fin.shift.close', p_property_id);
  if v_key = '' then perform app.fail('E_REQUIRED', 'An idempotency key is required.'); end if;
  if v_float < 0 then perform app.fail('E_INVALID', 'The opening float cannot be negative.'); end if;
  select tenant_id into v_tenant from public.properties where id = p_property_id;
  select id into v_id from public.cashier_shifts where tenant_id = v_tenant and idempotency_key = v_key and user_id = auth.uid();
  if v_id is not null then return v_id; end if;
  if exists (select 1 from public.cashier_shifts where user_id = auth.uid() and property_id = p_property_id and status = 'open') then
    perform app.fail('E_SHIFT_OPEN', 'You already have an open shift. Close it before opening another.');
  end if;
  insert into public.cashier_shifts(tenant_id, property_id, user_id, idempotency_key, business_date, opening_float)
  values (v_tenant, p_property_id, auth.uid(), v_key, (select business_date from public.properties where id = p_property_id), round(v_float, 2))
  returning id into v_id;
  return v_id;
end $$;

-- Reads one shift: the cashier's own, or any at a hotel where the caller can reconcile.
create or replace function public.cashier_shift_summary(p_shift uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare s public.cashier_shifts;
begin
  select * into s from public.cashier_shifts where id = p_shift and tenant_id = app.my_tenant();
  if s.id is null then perform app.fail('E_NOT_FOUND', 'Shift not found.'); end if;
  if s.user_id <> auth.uid() and not app.can('fin.shift.reconcile', s.property_id) then
    perform app.fail('E_FORBIDDEN', 'You cannot see this shift.'); end if;
  return app.shift_json(s.id);
end $$;

-- Closes a shift with the counted amounts: [{"payment_method_id": "...", "counted": 12345.00}].
-- Every method that took money must be counted. A difference needs a note. Works while the hotel is read-only.
create or replace function public.close_cashier_shift(p_shift uuid, p_counts jsonb, p_note text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare sh public.cashier_shifts; e record; c jsonb; v_counted numeric; v_var numeric; v_total numeric := 0;
        v_note text := nullif(btrim(coalesce(p_note, '')), ''); v_seen uuid[] := '{}'; v_id uuid; v_exp numeric;
begin
  perform app.assert_writable(true);
  select * into sh from public.cashier_shifts where id = p_shift and tenant_id = app.my_tenant() for update;
  if sh.id is null then perform app.fail('E_NOT_FOUND', 'Shift not found.'); end if;
  if sh.user_id = auth.uid() then
    if not app.can('fin.shift.close', sh.property_id) then perform app.fail('E_FORBIDDEN', 'You do not have permission to do this.'); end if;
  elsif not app.can('fin.shift.reconcile', sh.property_id) then
    perform app.fail('E_FORBIDDEN', 'You can only close your own shift.');
  end if;
  if sh.status <> 'open' then perform app.fail('E_INVALID', 'This shift is already closed.'); end if;
  if p_counts is null or jsonb_typeof(p_counts) <> 'array' then perform app.fail('E_INVALID', 'Send the counted amounts as a list.'); end if;

  for c in select * from jsonb_array_elements(p_counts) loop
    begin v_id := (c->>'payment_method_id')::uuid; v_counted := (c->>'counted')::numeric;
    exception when others then perform app.fail('E_INVALID', 'Each count needs a payment method and an amount.'); end;
    if v_counted is null or v_counted < 0 then perform app.fail('E_INVALID', 'A counted amount cannot be negative.'); end if;
    if v_id = any(v_seen) then perform app.fail('E_INVALID', 'Each payment method can be counted once.'); end if;
    if not exists (select 1 from public.payment_methods where id = v_id and property_id = sh.property_id) then
      perform app.fail('E_INVALID', 'Unknown payment method.'); end if;
    v_seen := v_seen || v_id;
  end loop;
  for e in select * from app.shift_expected(sh.id) loop
    if e.expected <> 0 and not (e.payment_method_id = any(v_seen)) then
      perform app.fail('E_INVALID', format('Count the %s too. It took money in this shift.', e.method_name));
    end if;
  end loop;

  for c in select * from jsonb_array_elements(p_counts) loop
    v_id := (c->>'payment_method_id')::uuid; v_counted := round((c->>'counted')::numeric, 2);
    v_exp := coalesce((select expected from app.shift_expected(sh.id) where payment_method_id = v_id), 0);
    v_var := v_counted - v_exp;
    v_total := v_total + v_var;
  end loop;
  if v_total <> 0 and v_note is null then perform app.fail('E_REQUIRED', 'Add a note to explain the difference.'); end if;
  if sh.user_id <> auth.uid() and v_note is null then perform app.fail('E_REQUIRED', 'Add a note to say why you closed this shift for someone else.'); end if;

  for c in select * from jsonb_array_elements(p_counts) loop
    v_id := (c->>'payment_method_id')::uuid; v_counted := round((c->>'counted')::numeric, 2);
    v_exp := coalesce((select expected from app.shift_expected(sh.id) where payment_method_id = v_id), 0);
    insert into public.cashier_shift_lines(tenant_id, property_id, shift_id, payment_method_id, expected, counted, variance)
    values (sh.tenant_id, sh.property_id, sh.id, v_id, v_exp, v_counted, v_counted - v_exp);
  end loop;
  update public.cashier_shifts set status = 'closed', closed_at = now(), closed_by = auth.uid(), close_note = v_note, variance_total = v_total
   where id = sh.id;
  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after)
  values (sh.tenant_id, auth.uid(), 'close_cashier_shift', 'cashier_shifts', sh.id::text, jsonb_build_object('variance_total', v_total));
  return app.shift_json(sh.id);
end $$;

-- A manager checks a closed shift. Not the person who closed it.
create or replace function public.reconcile_cashier_shift(p_shift uuid, p_note text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare sh public.cashier_shifts; v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into sh from public.cashier_shifts where id = p_shift and tenant_id = app.my_tenant() for update;
  if sh.id is null then perform app.fail('E_NOT_FOUND', 'Shift not found.'); end if;
  perform app.require('fin.shift.reconcile', sh.property_id);
  if sh.status <> 'closed' then perform app.fail('E_INVALID', 'Close the shift before reconciling it.'); end if;
  if sh.reconciled_at is not null then perform app.fail('E_INVALID', 'This shift is already reconciled.'); end if;
  if sh.closed_by = auth.uid() then perform app.fail('E_SOD', 'Someone else must reconcile a shift you closed.'); end if;
  if coalesce(sh.variance_total, 0) <> 0 and v_note is null then perform app.fail('E_REQUIRED', 'Add a note about the difference.'); end if;
  update public.cashier_shifts set reconciled_at = now(), reconciled_by = auth.uid(), reconcile_note = v_note where id = sh.id;
  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after)
  values (sh.tenant_id, auth.uid(), 'reconcile_cashier_shift', 'cashier_shifts', sh.id::text, jsonb_build_object('variance_total', sh.variance_total));
  return app.shift_json(sh.id);
end $$;

-- The shifts the caller may see at one hotel. p_status: open, closed or unreconciled (closed with a difference).
create or replace function public.list_cashier_shifts(p_property_id uuid, p_from date, p_to date, p_status text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not (app.can('fin.shift.close', p_property_id) or app.can('fin.shift.reconcile', p_property_id)) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to do this.'); end if;
  if p_status is not null and p_status not in ('open', 'closed', 'unreconciled') then
    perform app.fail('E_INVALID', 'Unknown shift status.'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', s.id, 'cashier_id', s.user_id, 'cashier_name', p.full_name, 'status', s.status,
        'business_date', s.business_date, 'opened_at', s.opened_at, 'closed_at', s.closed_at,
        'opening_float', round(s.opening_float, 2), 'variance_total', round(s.variance_total, 2),
        'reconciled', s.reconciled_at is not null) order by s.opened_at desc, s.id)
    from (select * from public.cashier_shifts x
           where x.property_id = p_property_id and x.tenant_id = app.my_tenant()
             and (x.user_id = auth.uid() or app.can('fin.shift.reconcile', x.property_id))
             and (p_from is null or x.business_date >= p_from) and (p_to is null or x.business_date <= p_to)
             and (p_status is null or (p_status = 'open' and x.status = 'open') or (p_status = 'closed' and x.status = 'closed')
                  or (p_status = 'unreconciled' and x.status = 'closed' and coalesce(x.variance_total, 0) <> 0 and x.reconciled_at is null))
           order by x.opened_at desc, x.id limit 200) s
    join public.profiles p on p.id = s.user_id), '[]'::jsonb);
end $$;

-- A hotel can insist on an open shift before any payment is taken.
create or replace function public.set_cashier_shift_required(p_property_id uuid, p_required boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid;
begin
  perform app.require('setup.property.edit', p_property_id);
  update public.properties set require_cashier_shift = coalesce(p_required, false) where id = p_property_id returning tenant_id into v_tenant;
  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after)
  values (v_tenant, auth.uid(), 'set_cashier_shift_required', 'properties', p_property_id::text,
    jsonb_build_object('require_cashier_shift', coalesce(p_required, false)));
end $$;

-- What is still open before the day closes. "blocking" items should be cleared first; "warnings" need a look.
create or replace function public.night_audit_flags(p_property_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_date date; v_open int; v_names text; v_unrec int; v_dep int; v_arr int; v_blocking jsonb := '[]'; v_warn jsonb := '[]';
begin
  if not exists (select 1 from public.properties where id = p_property_id and tenant_id = app.my_tenant())
     or not app.can('fin.nightaudit.run', p_property_id) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to do this.'); end if;
  select business_date into v_date from public.properties where id = p_property_id;

  select count(*), string_agg(p.full_name, ', ' order by p.full_name) into v_open, v_names
    from public.cashier_shifts s join public.profiles p on p.id = s.user_id where s.property_id = p_property_id and s.status = 'open';
  if v_open > 0 then
    v_blocking := v_blocking || jsonb_build_object('code', 'open_shifts', 'title', 'Cashier shifts still open', 'count', v_open, 'detail', v_names);
  end if;

  select count(*) into v_unrec from public.cashier_shifts
   where property_id = p_property_id and status = 'closed' and coalesce(variance_total, 0) <> 0 and reconciled_at is null;
  if v_unrec > 0 then
    v_warn := v_warn || jsonb_build_object('code', 'unreconciled_shifts', 'title', 'Closed shifts with a difference nobody has reconciled', 'count', v_unrec, 'detail', null);
  end if;

  select count(*) into v_dep from public.reservations where property_id = p_property_id and status = 'checked_in' and departure_date <= v_date;
  if v_dep > 0 then
    v_warn := v_warn || jsonb_build_object('code', 'departures_in_house', 'title', 'Guests still in house on or past their departure date', 'count', v_dep, 'detail', null);
  end if;

  select count(*) into v_arr from public.reservations where property_id = p_property_id and status = 'confirmed' and arrival_date <= v_date;
  if v_arr > 0 then
    v_warn := v_warn || jsonb_build_object('code', 'arrivals_waiting', 'title', 'Bookings due to arrive that have not checked in', 'count', v_arr, 'detail', null);
  end if;

  return jsonb_build_object('business_date', v_date, 'blocking', v_blocking, 'warnings', v_warn);
end $$;

revoke all on function public.open_cashier_shift(uuid, numeric, text), public.cashier_shift_summary(uuid),
  public.close_cashier_shift(uuid, jsonb, text), public.reconcile_cashier_shift(uuid, text),
  public.list_cashier_shifts(uuid, date, date, text), public.set_cashier_shift_required(uuid, boolean),
  public.night_audit_flags(uuid) from public, anon;
grant execute on function public.open_cashier_shift(uuid, numeric, text), public.cashier_shift_summary(uuid),
  public.close_cashier_shift(uuid, jsonb, text), public.reconcile_cashier_shift(uuid, text),
  public.list_cashier_shifts(uuid, date, date, text), public.set_cashier_shift_required(uuid, boolean),
  public.night_audit_flags(uuid) to authenticated;

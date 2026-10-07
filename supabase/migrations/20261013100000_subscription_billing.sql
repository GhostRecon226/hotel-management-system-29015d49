-- Subscription billing, database layer (PLT-012).
--
-- A hotel picks a plan and pays online through a payment provider (Paystack first). The provider tells us the
-- result with a webhook. Postgres decides what that result means:
--   * a payment row is made first, with the price read from the database (the browser never sends an amount);
--   * the webhook function checks the amount and currency, then activates the plan and adds the paid period;
--   * every provider event is stored once, so a resend changes nothing;
--   * a paid payment can never be undone or paid twice by a later event.
-- The provider name is only a label. Switching to Flutterwave later needs no schema change.
--
-- Prices are not decided yet (A16). plan prices start empty. Until Peter sets prices, nobody can pay online
-- and hotels stay on manual activation.

-- 1. Prices live on the plan as a small list per currency, in the smallest unit (kobo, pesewa, cent):
--    {"NGN": {"month": 6000000, "year": 60000000}}. Empty until A16 is decided. Hotels already read plans.
alter table public.plans add column prices jsonb not null default '{}'::jsonb
  check (jsonb_typeof(prices) = 'object');

-- 2. Payments the hotel started. Written only by the functions below.
create table public.subscription_payments (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  plan_code        text not null references public.plans(code),
  interval         text not null check (interval in ('month', 'year')),
  provider         text not null default 'paystack',
  reference        text not null unique,
  idempotency_key  text not null,
  amount_minor     bigint not null check (amount_minor > 0),
  currency         char(3) not null,
  status           text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  failure_reason   text,
  paid_at          timestamptz,
  created_by       uuid,
  created_at       timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);
create index subscription_payments_tenant_idx on public.subscription_payments(tenant_id, created_at desc);
create index subscription_payments_open_idx on public.subscription_payments(status, created_at) where status <> 'paid';
alter table public.subscription_payments enable row level security;
create policy subscription_payments_read on public.subscription_payments for select to authenticated
  using (tenant_id = app.my_tenant() and app.can('adm.subscription.manage', null));
grant select on public.subscription_payments to authenticated;

-- 3. Provider events, stored once each. tenant_id is empty only when the reference was unknown.
create table public.billing_events (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references public.tenants(id) on delete cascade,
  provider     text not null,
  event_id     text not null,
  reference    text,
  outcome      text not null check (outcome in ('success', 'failed')),
  result       text,
  received_at  timestamptz not null default now(),
  unique (provider, event_id)
);
alter table public.billing_events enable row level security;
revoke all on public.billing_events from public, anon, authenticated;

-- 4. The history can now say a change came from online billing.
alter table public.subscription_history drop constraint subscription_history_source_check;
alter table public.subscription_history add constraint subscription_history_source_check
  check (source in ('clock', 'platform', 'hotel', 'billing'));

-- 5. Does the hotel fit the plan? One check for buying and changing plans.
create or replace function app.assert_plan_fits(p_tenant uuid, p_plan text)
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_plan public.plans; v_rooms int; v_props int; v_users int;
begin
  select * into v_plan from public.plans where code = p_plan;
  if v_plan.code is null then perform app.fail('E_NOT_FOUND', 'Plan not found.'); end if;
  select count(*) into v_rooms from public.rooms where tenant_id = p_tenant and is_active;
  select count(*) into v_props from public.properties where tenant_id = p_tenant;
  select count(*) into v_users from public.profiles where tenant_id = p_tenant and status = 'active';
  if (v_plan.max_rooms is not null and v_rooms > v_plan.max_rooms)
     or (v_plan.max_properties is not null and v_props > v_plan.max_properties)
     or (v_plan.max_users is not null and v_users > v_plan.max_users) then
    perform app.fail('E_PLAN_LIMIT', format('This hotel uses %s rooms, %s properties and %s users, more than the %s plan allows.',
      v_rooms, v_props, v_users, v_plan.name));
  end if;
end $$;
revoke all on function app.assert_plan_fits(uuid, text) from public, anon, authenticated;

-- 6. Platform operators set prices.
create or replace function public.platform_set_plan_price(p_plan text, p_currency text, p_interval text, p_amount_minor bigint)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cur text := upper(btrim(coalesce(p_currency, '')));
begin
  perform app.require_platform();
  if not exists (select 1 from public.plans where code = p_plan) then perform app.fail('E_NOT_FOUND', 'Plan not found.'); end if;
  if p_interval not in ('month', 'year') then perform app.fail('E_INVALID', 'The period must be month or year.'); end if;
  if v_cur !~ '^[A-Z]{3}$' then perform app.fail('E_INVALID', 'Use a three letter currency code, for example NGN.'); end if;
  if p_amount_minor is null or p_amount_minor <= 0 then perform app.fail('E_INVALID', 'The price must be above zero.'); end if;
  update public.plans set prices = jsonb_set(
      case when prices ? v_cur then prices else prices || jsonb_build_object(v_cur, '{}'::jsonb) end,
      array[v_cur, p_interval], to_jsonb(p_amount_minor))
   where code = p_plan;
end $$;

-- 7. A hotel administrator starts a payment. The price comes from the database. A retry with the same key
--    returns the first payment.
create or replace function public.start_subscription_payment(p_plan text, p_interval text, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid := app.my_tenant(); v_key text := btrim(coalesce(p_idempotency_key, ''));
        v_cur text; v_amount bigint; p public.subscription_payments;
begin
  if v_tenant is null or not app.can('adm.subscription.manage', null) then
    perform app.fail('E_FORBIDDEN', 'You cannot change the subscription.'); end if;
  if v_key = '' then perform app.fail('E_REQUIRED', 'An idempotency key is required.'); end if;
  select * into p from public.subscription_payments where tenant_id = v_tenant and idempotency_key = v_key;
  if p.id is not null then
    return jsonb_build_object('payment_id', p.id, 'reference', p.reference, 'amount_minor', p.amount_minor,
      'currency', p.currency, 'plan_code', p.plan_code, 'interval', p.interval, 'status', p.status);
  end if;
  if p_interval not in ('month', 'year') then perform app.fail('E_INVALID', 'The period must be month or year.'); end if;
  if not exists (select 1 from public.plans where code = p_plan) then perform app.fail('E_NOT_FOUND', 'Plan not found.'); end if;
  select base_currency into v_cur from public.properties where tenant_id = v_tenant order by created_at, id limit 1;
  select (prices -> v_cur ->> p_interval)::bigint into v_amount from public.plans where code = p_plan;
  if v_amount is null then
    perform app.fail('E_NO_PRICE', format('There is no %s price for this plan in %s yet. Please contact support.', p_interval, coalesce(v_cur, 'your currency')));
  end if;
  perform app.assert_plan_fits(v_tenant, p_plan);
  insert into public.subscription_payments(tenant_id, plan_code, interval, reference, idempotency_key, amount_minor, currency, created_by)
  values (v_tenant, p_plan, p_interval, 'hd_' || replace(gen_random_uuid()::text, '-', ''), v_key, v_amount, v_cur, auth.uid())
  returning * into p;
  return jsonb_build_object('payment_id', p.id, 'reference', p.reference, 'amount_minor', p.amount_minor,
    'currency', p.currency, 'plan_code', p.plan_code, 'interval', p.interval, 'status', p.status);
end $$;

-- 8. The webhook. Only the server (service role) calls this, after it has verified the provider's signature.
--    Returns what happened: applied, duplicate, ignored, mismatch or unknown_reference.
create or replace function public.billing_apply_event(p_provider text, p_event_id text, p_reference text,
  p_outcome text, p_amount_minor bigint, p_currency text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare pay public.subscription_payments; s public.tenant_subscriptions; v_new uuid; v_base timestamptz; v_end timestamptz; v_result text;
begin
  if p_outcome not in ('success', 'failed') then perform app.fail('E_INVALID', 'Unknown outcome.'); end if;
  if coalesce(btrim(p_provider), '') = '' or coalesce(btrim(p_event_id), '') = '' then
    perform app.fail('E_REQUIRED', 'Provider and event id are required.'); end if;

  select * into pay from public.subscription_payments where reference = p_reference for update;

  insert into public.billing_events(tenant_id, provider, event_id, reference, outcome)
  values (pay.tenant_id, p_provider, p_event_id, p_reference, p_outcome)
  on conflict (provider, event_id) do nothing
  returning id into v_new;
  if v_new is null then return 'duplicate'; end if;

  if pay.id is null then v_result := 'unknown_reference';
  elsif pay.status = 'paid' then v_result := 'ignored';
  elsif p_outcome = 'failed' then
    update public.subscription_payments set status = 'failed', failure_reason = 'The payment provider reported a failed payment.' where id = pay.id;
    v_result := 'applied';
  elsif p_amount_minor is distinct from pay.amount_minor or upper(coalesce(p_currency, '')) <> pay.currency then
    update public.subscription_payments set status = 'failed', failure_reason = 'The amount or currency did not match what was charged.' where id = pay.id;
    v_result := 'mismatch';
  else
    select * into s from public.tenant_subscriptions where tenant_id = pay.tenant_id for update;
    v_base := case when s.status = 'active' and s.current_period_end is not null then greatest(now(), s.current_period_end) else now() end;
    v_end := v_base + case pay.interval when 'year' then interval '1 year' else interval '1 month' end;
    update public.subscription_payments set status = 'paid', paid_at = now(), failure_reason = null where id = pay.id;
    perform app.change_subscription(pay.tenant_id, 'active', 'active',
      format('Paid online (%s %s)', p_provider, pay.reference), 'billing', v_end, pay.plan_code);
    v_result := 'applied';
  end if;

  update public.billing_events set result = v_result where id = v_new;
  return v_result;
end $$;

-- 9. The failed-payment queue for platform operators: failed payments from the last 60 days, and payments
--    still pending after a day (the hotel probably left the checkout page).
create or replace function public.platform_failed_payments()
returns table (payment_id uuid, created_at timestamptz, tenant_id uuid, tenant_name text, plan_code text,
  period text, amount_minor bigint, currency text, status text, reference text, failure_reason text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform app.require_platform();
  return query
  select p.id, p.created_at, p.tenant_id, t.name, p.plan_code, p.interval, p.amount_minor, p.currency::text,
         p.status, p.reference, p.failure_reason
  from public.subscription_payments p join public.tenants t on t.id = p.tenant_id
  where (p.status = 'failed' and p.created_at > now() - interval '60 days')
     or (p.status = 'pending' and p.created_at < now() - interval '1 day')
  order by p.created_at desc;
end $$;

revoke all on function public.platform_set_plan_price(text, text, text, bigint), public.start_subscription_payment(text, text, text),
  public.billing_apply_event(text, text, text, text, bigint, text), public.platform_failed_payments() from public, anon, authenticated;
grant execute on function public.platform_set_plan_price(text, text, text, bigint), public.start_subscription_payment(text, text, text),
  public.platform_failed_payments() to authenticated;
grant execute on function public.billing_apply_event(text, text, text, text, bigint, text) to service_role;

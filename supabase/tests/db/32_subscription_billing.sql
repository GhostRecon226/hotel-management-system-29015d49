-- Subscription billing, database layer (PLT-012). A hotel picks a plan and pays online. The payment provider
-- (Paystack first) tells us the result through a webhook. The database decides what that result means:
-- it activates the plan once, never twice, and never when the amount is wrong.
begin;

create function t.as_user(p_user uuid, p_aal text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', p_user::text, false);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, false);
  execute 'set role authenticated';
end $$;
create function t.svc() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', false);
  execute 'set role service_role';
end $$;
create function t.pay_ref(p_key text) returns text language sql stable security definer as $$
  select reference from public.subscription_payments where tenant_id = t.id('tenantA') and idempotency_key = p_key $$;
grant execute on function t.as_user(uuid, text), t.svc(), t.pay_ref(text) to authenticated, service_role;
-- The server role runs the webhook function, so the test helpers must work under it too (rolled back with the file).
grant usage on schema t to service_role;
grant execute on all functions in schema t to service_role;

-- Prices: set only by platform operators (two-step sign-in), in the smallest unit (kobo).
do $$
declare v_op uuid := gen_random_uuid();
begin
  perform t.admin();
  insert into auth.users (id, email, email_confirmed_at, aud, role) values (v_op, 'billing-op@platform.test', now(), 'authenticated', 'authenticated');
  perform t.put('bop', v_op);
  perform app.add_platform_operator('billing-op@platform.test');
  perform t.login('adminA');
  perform t.raises($q$select public.platform_set_plan_price('standard', 'NGN', 'month', 5000000)$q$, 'E_FORBIDDEN', '[PLT-012] a hotel administrator cannot set prices');
  perform t.as_user(v_op, 'aal1');
  perform t.raises($q$select public.platform_set_plan_price('standard', 'NGN', 'month', 5000000)$q$, 'E_MFA_REQUIRED', '[PLT-012] prices need two-step sign-in');
  perform t.as_user(v_op, 'aal2');
  perform t.raises($q$select public.platform_set_plan_price('nope', 'NGN', 'month', 5000000)$q$, 'E_NOT_FOUND', '[PLT-012] an unknown plan is refused');
  perform t.raises($q$select public.platform_set_plan_price('standard', 'NGN', 'week', 5000000)$q$, 'E_INVALID', '[PLT-012] only monthly and yearly prices exist');
  perform t.raises($q$select public.platform_set_plan_price('standard', 'NGN', 'month', 0)$q$, 'E_INVALID', '[PLT-012] a price must be above zero');
  perform public.platform_set_plan_price('standard', 'NGN', 'month', 5000000);
  perform public.platform_set_plan_price('standard', 'NGN', 'year', 50000000);
  perform public.platform_set_plan_price('standard', 'NGN', 'month', 6000000);
  perform t.admin();
  perform t.eq((select (prices->'NGN'->>'month')::bigint from public.plans where code = 'standard'), 6000000::bigint, '[PLT-012] setting a price again replaces it');
  perform t.eq((select count(*)::int from public.plans, jsonb_each(prices->'NGN') where code = 'standard'), 2, '[PLT-012] one price per plan, currency and period');
  perform t.login('adminA');
  perform t.eq((select (prices->'NGN'->>'year')::bigint from public.plans where code = 'standard'), 50000000::bigint, '[PLT-012] a hotel can read the prices');
  perform t.raises($q$update public.plans set prices = '{}'$q$, 'permission denied', '[PLT-012] but not write them');
  perform t.admin();
end $$;

-- Starting a payment.
do $$
declare j jsonb; j2 jsonb; v_sub timestamptz;
begin
  perform t.admin();
  perform t.set_tenant_status(t.id('tenantA'), 'trial');
  perform t.login('fdo');
  perform t.raises($q$select public.start_subscription_payment('standard', 'month', 'k-fdo')$q$, 'E_FORBIDDEN', '[PLT-012] staff without billing rights cannot start a payment');
  perform t.anon();
  perform t.raises($q$select public.start_subscription_payment('standard', 'month', 'k-anon')$q$, 'permission denied', '[PLT-012] nor a signed-out visitor');
  perform t.login('adminA');
  perform t.raises($q$select public.start_subscription_payment('standard', 'month', '')$q$, 'E_REQUIRED', '[PLT-012] a payment needs an idempotency key');
  perform t.raises($q$select public.start_subscription_payment('standard', 'week', 'k1')$q$, 'E_INVALID', '[PLT-012] the period must be month or year');
  perform t.raises($q$select public.start_subscription_payment('nope', 'month', 'k1')$q$, 'E_NOT_FOUND', '[PLT-012] an unknown plan is refused');
  perform t.raises($q$select public.start_subscription_payment('pro', 'month', 'k1')$q$, 'E_NO_PRICE', '[PLT-012] a plan with no price cannot be bought');
  j := public.start_subscription_payment('standard', 'month', 'k-a1');
  perform t.eq((j->>'amount_minor')::bigint, 6000000::bigint, '[PLT-012] the price comes from the database');
  perform t.eq(j->>'currency', 'NGN', '[PLT-012] in the hotel''s currency');
  perform t.ok((j->>'reference') is not null and length(j->>'reference') >= 10, '[PLT-012] the payment gets a reference');
  j2 := public.start_subscription_payment('standard', 'month', 'k-a1');
  perform t.eq(j2->>'reference', j->>'reference', '[PLT-012] a retry with the same key returns the first payment');
  perform t.admin();
  perform t.eq((select count(*)::int from public.subscription_payments where tenant_id = t.id('tenantA')), 1, '[PLT-012] and creates no second row');
  perform t.eq((select status from public.subscription_payments where reference = j->>'reference'), 'pending', '[PLT-012] a new payment waits as pending');
  perform t.eq((select status from public.tenant_subscriptions where tenant_id = t.id('tenantA')), 'trial', '[PLT-012] starting a payment changes nothing yet');
  perform t.login('adminB');
  perform t.eq((select count(*)::int from public.subscription_payments), 0, '[PLT-012] another hotel sees none of these payments');
  perform t.login('adminA');
  perform t.eq((select count(*)::int from public.subscription_payments), 1, '[PLT-012] this hotel sees its own');
  perform t.raises($q$update public.subscription_payments set status = 'paid'$q$, 'permission denied', '[PLT-012] a hotel cannot mark a payment paid');
  perform t.admin();
  -- A plan the hotel has outgrown is refused before any money moves.
  update public.plans set max_users = 1 where code = 'standard';
  perform t.login('adminA');
  perform t.raises($q$select public.start_subscription_payment('standard', 'year', 'k-a2')$q$, 'E_PLAN_LIMIT', '[PLT-012] a plan the hotel has outgrown cannot be bought');
  perform t.admin();
  update public.plans set max_users = 25 where code = 'standard';
end $$;

-- The webhook: only the server (service role) can call it. Each provider event counts once.
do $$
declare v_ref text := t.pay_ref('k-a1'); r text; v_end timestamptz; v_h int; v_n int;
begin
  perform t.login('adminA');
  perform t.raises(format($q$select public.billing_apply_event('paystack', 'e1', %L, 'success', 6000000, 'NGN')$q$, v_ref), 'permission denied', '[PLT-012] a hotel cannot call the webhook function');
  perform t.anon();
  perform t.raises(format($q$select public.billing_apply_event('paystack', 'e1', %L, 'success', 6000000, 'NGN')$q$, v_ref), 'permission denied', '[PLT-012] nor can a signed-out visitor');
  perform t.svc();
  r := public.billing_apply_event('paystack', 'e0', 'no-such-ref', 'success', 100, 'NGN');
  perform t.eq(r, 'unknown_reference', '[PLT-012] an event for an unknown reference changes nothing');
  r := public.billing_apply_event('paystack', 'e-wrong', v_ref, 'success', 5999999, 'NGN');
  perform t.eq(r, 'mismatch', '[PLT-012] a wrong amount is not accepted');
  perform t.admin();
  perform t.eq((select status from public.tenant_subscriptions where tenant_id = t.id('tenantA')), 'trial', '[PLT-012] and does not activate the plan');
  perform t.eq((select status from public.subscription_payments where reference = v_ref), 'failed', '[PLT-012] the payment shows as failed with the reason');
  perform t.ok((select failure_reason from public.subscription_payments where reference = v_ref) ilike '%amount%', '[PLT-012] the reason names the amount');
end $$;

do $$
declare j jsonb; v_ref text; r text; v_end timestamptz; v_h int; v_end2 timestamptz;
begin
  perform t.admin();
  perform t.login('adminA');
  j := public.start_subscription_payment('standard', 'month', 'k-a3');
  v_ref := j->>'reference';
  perform t.admin();
  v_h := (select count(*)::int from public.subscription_history where tenant_id = t.id('tenantA'));
  perform t.svc();
  r := public.billing_apply_event('paystack', 'e-ok', v_ref, 'success', 6000000, 'GHS');
  perform t.eq(r, 'mismatch', '[PLT-012] a wrong currency is not accepted');
  perform t.admin();
  perform t.login('adminA');
  j := public.start_subscription_payment('standard', 'month', 'k-a4');
  v_ref := j->>'reference';
  perform t.svc();
  r := public.billing_apply_event('paystack', 'e-good', v_ref, 'success', 6000000, 'NGN');
  perform t.eq(r, 'applied', '[PLT-012] a matching success event is applied');
  perform t.admin();
  select current_period_end into v_end from public.tenant_subscriptions where tenant_id = t.id('tenantA');
  perform t.eq((select status from public.tenant_subscriptions where tenant_id = t.id('tenantA')), 'active', '[PLT-012] the plan becomes active');
  perform t.eq((select plan_code from public.tenant_subscriptions where tenant_id = t.id('tenantA')), 'standard', '[PLT-012] on the plan that was paid for');
  perform t.eq((select status from public.tenants where id = t.id('tenantA')), 'active', '[PLT-012] and the hotel is writable');
  perform t.ok(v_end > now() + interval '27 days' and v_end < now() + interval '32 days', '[PLT-012] one month is added');
  perform t.eq((select status from public.subscription_payments where reference = v_ref), 'paid', '[PLT-012] the payment is marked paid');
  perform t.eq((select count(*)::int from public.subscription_history where tenant_id = t.id('tenantA') and source = 'billing'), 1, '[PLT-012] the change is in the history as online billing');
  -- Same event again (providers resend): nothing happens.
  perform t.svc();
  r := public.billing_apply_event('paystack', 'e-good', v_ref, 'success', 6000000, 'NGN');
  perform t.eq(r, 'duplicate', '[PLT-012] the same event again is recognised');
  -- A different event for the same payment (Paystack can send two kinds): no second month.
  r := public.billing_apply_event('paystack', 'e-good-2', v_ref, 'success', 6000000, 'NGN');
  perform t.eq(r, 'ignored', '[PLT-012] a second event for a paid payment is ignored');
  perform t.admin();
  select current_period_end into v_end2 from public.tenant_subscriptions where tenant_id = t.id('tenantA');
  perform t.eq(v_end2, v_end, '[PLT-012] the paid period does not grow twice');
  perform t.eq((select count(*)::int from public.billing_events where provider = 'paystack' and event_id = 'e-good'), 1, '[PLT-012] each event is stored once');
  -- A later failure cannot undo a paid payment.
  perform t.svc();
  r := public.billing_apply_event('paystack', 'e-late-fail', v_ref, 'failed', 6000000, 'NGN');
  perform t.eq(r, 'ignored', '[PLT-012] a late failure does not undo a paid payment');
  perform t.admin();
  perform t.eq((select status from public.subscription_payments where reference = v_ref), 'paid', '[PLT-012] it stays paid');
end $$;

-- Paying again while active adds to the end of the paid period. A year adds a year.
do $$
declare j jsonb; v_ref text; v_before timestamptz; v_after timestamptz; r text;
begin
  perform t.admin();
  select current_period_end into v_before from public.tenant_subscriptions where tenant_id = t.id('tenantA');
  perform t.login('adminA');
  j := public.start_subscription_payment('standard', 'year', 'k-a5');
  v_ref := j->>'reference';
  perform t.eq((j->>'amount_minor')::bigint, 50000000::bigint, '[PLT-012] the yearly price is used for a year');
  perform t.svc();
  r := public.billing_apply_event('paystack', 'e-year', v_ref, 'success', 50000000, 'NGN');
  perform t.admin();
  select current_period_end into v_after from public.tenant_subscriptions where tenant_id = t.id('tenantA');
  perform t.eq(v_after, v_before + interval '1 year', '[PLT-012] a year is added to the end of the current paid period');
end $$;

-- Failures, the platform queue, and a suspended hotel that pays.
do $$
declare j jsonb; v_ref text; r text; n int;
begin
  perform t.admin();
  perform t.login('adminA');
  j := public.start_subscription_payment('standard', 'month', 'k-a6');
  v_ref := j->>'reference';
  perform t.svc();
  r := public.billing_apply_event('paystack', 'e-fail', v_ref, 'failed', 6000000, 'NGN');
  perform t.eq(r, 'applied', '[PLT-012] a failure event is recorded');
  perform t.raises($q$select public.billing_apply_event('paystack', 'e-x', 'r', 'maybe', 1, 'NGN')$q$, 'E_INVALID', '[PLT-012] an unknown outcome is refused');
  perform t.admin();
  perform t.eq((select status from public.subscription_payments where reference = v_ref), 'failed', '[PLT-012] the payment shows as failed');
  perform t.eq((select status from public.tenant_subscriptions where tenant_id = t.id('tenantA')), 'active', '[PLT-012] a failed top-up does not stop an active plan');

  perform t.login('adminA');
  perform t.raises($q$select * from public.platform_failed_payments()$q$, 'E_FORBIDDEN', '[PLT-012] a hotel cannot read the failed-payment queue');
  perform t.as_user(t.id('bop'), 'aal1');
  perform t.raises($q$select * from public.platform_failed_payments()$q$, 'E_MFA_REQUIRED', '[PLT-012] the queue needs two-step sign-in');
  perform t.as_user(t.id('bop'), 'aal2');
  select count(*) into n from public.platform_failed_payments() where reference = v_ref;
  perform t.eq(n, 1, '[PLT-012] the operator sees the failed payment');
  perform t.ok((select tenant_name from public.platform_failed_payments() where reference = v_ref) is not null, '[PLT-012] with the hotel name');
  perform t.admin();

  -- A suspended hotel that pays comes back.
  perform t.set_tenant_status(t.id('tenantA'), 'suspended');
  update public.tenant_subscriptions set status = 'suspended' where tenant_id = t.id('tenantA');
  perform t.login('adminA');
  j := public.start_subscription_payment('standard', 'month', 'k-a7');
  v_ref := j->>'reference';
  perform t.svc();
  r := public.billing_apply_event('paystack', 'e-back', v_ref, 'success', 6000000, 'NGN');
  perform t.eq(r, 'applied', '[PLT-012] a suspended hotel can pay');
  perform t.admin();
  perform t.eq((select status from public.tenants where id = t.id('tenantA')), 'active', '[PLT-012] and is writable again');
  perform t.ok((select current_period_end from public.tenant_subscriptions where tenant_id = t.id('tenantA')) > now() + interval '27 days', '[PLT-012] with a month from the day it paid');
end $$;

-- The payment tables are reachable only through the functions.
do $$
begin
  perform t.login('adminA');
  perform t.raises($q$insert into public.subscription_payments(tenant_id, plan_code, interval, provider, reference, idempotency_key, amount_minor, currency) values (gen_random_uuid(), 'standard', 'month', 'x', 'x', 'x', 1, 'NGN')$q$, 'permission denied', '[PLT-012] a hotel cannot insert a payment');
  perform t.raises($q$select count(*) from public.billing_events$q$, 'permission denied', '[PLT-012] nor read provider events');
  perform t.admin();
end $$;

rollback;

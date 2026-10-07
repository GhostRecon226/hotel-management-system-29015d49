-- Billing screen figures (PLT-012). The browser never works out money. billing_options() hands the Subscription
-- screen each plan with its price in whole currency (not kobo), whether the hotel fits it, and its own payments.
begin;

do $$
declare j jsonb; v_std jsonb; v_ref text;
begin
  perform t.admin();
  update public.plans set prices = '{"NGN": {"month": 6000000, "year": 60000000}}' where code = 'standard';
  update public.plans set prices = '{}' where code <> 'standard';
  update public.plans set max_users = 1 where code = 'starter';

  perform t.login('fdo');
  perform t.raises($q$select public.billing_options()$q$, 'E_FORBIDDEN', '[PLT-012] staff without billing rights cannot read the billing options');
  perform t.anon();
  perform t.raises($q$select public.billing_options()$q$, 'permission denied', '[PLT-012] nor a signed-out visitor');

  perform t.login('adminA');
  j := public.billing_options();
  perform t.eq(j->>'currency', 'NGN', '[PLT-012] the options use the hotel''s currency');
  select x into v_std from jsonb_array_elements(j->'plans') x where x->>'code' = 'standard';
  perform t.eq((v_std->>'month')::numeric, 60000.00, '[PLT-012] the monthly price is in whole naira, worked out by the database');
  perform t.eq((v_std->>'year')::numeric, 600000.00, '[PLT-012] and the yearly price');
  perform t.ok((v_std->>'can_buy')::boolean, '[PLT-012] a plan with a price that the hotel fits can be bought');
  perform t.ok((select (x->>'month') is null and not (x->>'can_buy')::boolean from jsonb_array_elements(j->'plans') x where x->>'code' = 'pro'),
    '[PLT-012] a plan with no price cannot be bought');
  perform t.ok((select not (x->>'fits')::boolean and not (x->>'can_buy')::boolean from jsonb_array_elements(j->'plans') x where x->>'code' = 'starter'),
    '[PLT-012] a plan the hotel has outgrown is marked as not fitting');
  perform t.eq((select count(*)::int from jsonb_array_elements(j->'payments')), 0, '[PLT-012] no payments yet');

  v_ref := (public.start_subscription_payment('standard', 'month', 'opt-1'))->>'reference';
  j := public.billing_options();
  perform t.eq((select (x->>'amount')::numeric from jsonb_array_elements(j->'payments') x limit 1), 60000.00, '[PLT-012] a payment is listed with its amount in whole naira');
  perform t.eq((select x->>'status' from jsonb_array_elements(j->'payments') x limit 1), 'pending', '[PLT-012] and its status');

  perform t.login('adminB');
  perform t.eq((select count(*)::int from jsonb_array_elements(public.billing_options()->'payments')), 0, '[PLT-012] another hotel sees none of these payments');
  perform t.admin();
end $$;

-- The operator queue shows whole naira too, so the console does no money arithmetic.
create function t.as_user(p_user uuid, p_aal text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', p_user::text, false);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, false);
  execute 'set role authenticated';
end $$;
grant execute on function t.as_user(uuid, text) to authenticated;
do $$
declare v_op uuid := gen_random_uuid(); v_ref text;
begin
  perform t.admin();
  insert into auth.users (id, email, email_confirmed_at, aud, role) values (v_op, 'queue-op@platform.test', now(), 'authenticated', 'authenticated');
  perform app.add_platform_operator('queue-op@platform.test');
  update public.subscription_payments set status = 'failed', failure_reason = 'The payment provider reported a failed payment.' where tenant_id = t.id('tenantA');
  perform t.as_user(v_op, 'aal2');
  perform t.eq((select amount from public.platform_failed_payments() limit 1), 60000.00, '[PLT-012] the failed-payment queue shows the amount in whole naira');
  perform t.admin();
end $$;

rollback;

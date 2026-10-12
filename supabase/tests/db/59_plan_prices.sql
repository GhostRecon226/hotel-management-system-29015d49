-- PLT-017: the A16 plan prices are in the plans table, in kobo, and a hotel is charged what the database says.
begin;

do $$
declare j jsonb;
begin
  perform t.admin();
  perform t.eq((select (prices->'NGN'->>'month')::bigint from public.plans where code = 'starter'), 3000000::bigint, '[PLT-017] Starter costs 30,000 naira a month');
  perform t.eq((select (prices->'NGN'->>'month')::bigint from public.plans where code = 'standard'), 4500000::bigint, '[PLT-017] Standard costs 45,000 naira a month');
  perform t.eq((select (prices->'NGN'->>'month')::bigint from public.plans where code = 'pro'), 8000000::bigint, '[PLT-017] Pro costs 80,000 naira a month');
  perform t.ok(not exists (
      select 1 from public.plans where code in ('starter', 'standard', 'pro')
         and (prices->'NGN'->>'year')::bigint <> (prices->'NGN'->>'month')::bigint * 10),
    '[PLT-017] a year costs ten months on every priced plan');
  perform t.eq((select prices from public.plans where code = 'enterprise'), '{}'::jsonb, '[PLT-017] Enterprise has no price because it is quoted');

  perform t.set_tenant_status(t.id('tenantA'), 'trial');
  perform t.login('adminA');
  j := public.start_subscription_payment('standard', 'year', 'plt017-a');
  perform t.eq((j->>'amount_minor')::bigint, 45000000::bigint, '[PLT-017] the yearly Standard payment is 450,000 naira');
  perform t.eq(j->>'currency', 'NGN', '[PLT-017] in naira');
  perform t.raises($q$select public.start_subscription_payment('enterprise', 'month', 'plt017-b')$q$, 'E_NO_PRICE', '[PLT-017] Enterprise cannot be bought online');
  perform t.admin();
end $$;

rollback;

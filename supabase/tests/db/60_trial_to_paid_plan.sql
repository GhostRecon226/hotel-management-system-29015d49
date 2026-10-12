-- Day 61 (PLT-018): when the 60-day trial ends, the hotel moves to the cheapest plan it fits, with 14 days to pay.
-- Peter's decision of 12 Oct 2026. Hotels that are too big for every priced plan land on Enterprise and are told to
-- contact us. The generic "payment overdue" email is not sent on top of the trial-end email.
begin;

create function t.sent(p_prefix text) returns integer language sql as $$
  select count(*)::int from public.notification_outbox
  where tenant_id = t.id('tenantA') and dedupe_key like p_prefix || ':%'
$$;

-- The cheapest plan that fits, and its price in words.
do $$
begin
  perform t.admin();
  perform t.eq(app.trial_plan(t.id('tenantA')), 'starter', '[PLT-018] a small hotel is placed on Starter');
  perform t.eq(app.plan_price_text('starter', t.id('tenantA')), '₦30,000', '[PLT-018] the price text comes from the plans table');
  perform t.eq(app.plan_price_text('pro', t.id('tenantA')), '₦80,000', '[PLT-018] Pro price text');
  perform t.ok(app.plan_price_text('enterprise', t.id('tenantA')) is null, '[PLT-018] Enterprise has no price text');
  update public.plans set max_rooms = 3 where code = 'starter';
  perform t.eq(app.trial_plan(t.id('tenantA')), 'standard', '[PLT-018] a hotel too big for Starter is placed on Standard');
  update public.plans set max_rooms = 3 where code in ('standard', 'pro');
  perform t.eq(app.trial_plan(t.id('tenantA')), 'enterprise', '[PLT-018] a hotel too big for every priced plan is placed on Enterprise');
  update public.plans set max_rooms = 20 where code = 'starter';
  update public.plans set max_rooms = 60 where code = 'standard';
  update public.plans set max_rooms = 150 where code = 'pro';
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('plan choice', sqlerrm);
end $$;

-- A small hotel: trial ends, Starter, past due, one email with plan and price, no second overdue email.
do $$
declare v_body text; v_end timestamptz := now() - interval '1 hour';
begin
  perform t.admin();
  perform t.set_tenant_status(t.id('tenantA'), 'trial');
  delete from public.notification_outbox;
  update public.tenant_subscriptions set trial_ends_at = v_end, plan_code = 'pro' where tenant_id = t.id('tenantA');
  perform app.run_subscription_clock();
  perform app.run_subscription_clock();
  perform t.eq((select status from public.tenants where id = t.id('tenantA')), 'past_due', '[PLT-018] when the trial ends the hotel keeps working and has time to pay');
  perform t.eq((select plan_code from public.tenant_subscriptions where tenant_id = t.id('tenantA')), 'starter', '[PLT-018] the hotel moves to the cheapest plan it fits');
  perform t.eq((select current_period_end from public.tenant_subscriptions where tenant_id = t.id('tenantA')), v_end, '[PLT-018] the 14 days to pay count from the day the trial ended');
  perform t.ok(exists (select 1 from public.subscription_history where tenant_id = t.id('tenantA') and to_status = 'past_due' and plan_code = 'starter' and source = 'clock'),
    '[PLT-018] the move is in the subscription history with the plan');
  perform t.eq(t.sent('trialend'), 2, '[PLT-018] each administrator gets one trial-end email, even after two clock runs');
  perform t.eq(t.sent('pastdue'), 0, '[PLT-018] no second "payment overdue" email on top of it');
  select body into v_body from public.notification_outbox where dedupe_key like 'trialend:%' limit 1;
  perform t.ok(v_body like '%Starter%' and v_body like '%₦30,000%' and v_body like '%hello@zikorahq.com%' and v_body like '%read-only%' and lower(v_body) like '%nothing is deleted%',
    '[PLT-018] the email names the plan and the price, says what happens, and who to contact');
  perform t.ok(v_body not like '%—%', '[PLT-018] no em dash in the email');

  -- The existing rule still applies: unpaid for more than 14 days becomes suspended.
  update public.tenant_subscriptions set current_period_end = now() - interval '15 days' where tenant_id = t.id('tenantA');
  perform app.run_subscription_clock();
  perform t.eq((select status from public.tenants where id = t.id('tenantA')), 'suspended', '[PLT-018] unpaid after the 14 days, the hotel becomes read-only');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('trial end to paid plan', sqlerrm);
end $$;

-- A hotel too big for any priced plan: Enterprise, told to contact us, no price in the email.
do $$
declare v_body text;
begin
  perform t.admin();
  update public.plans set max_rooms = 3 where code in ('starter', 'standard', 'pro');
  perform t.set_tenant_status(t.id('tenantA'), 'trial');
  delete from public.notification_outbox;
  update public.tenant_subscriptions set trial_ends_at = now() - interval '1 hour', plan_code = 'starter' where tenant_id = t.id('tenantA');
  perform app.run_subscription_clock();
  perform t.eq((select plan_code from public.tenant_subscriptions where tenant_id = t.id('tenantA')), 'enterprise', '[PLT-018] a large hotel moves to Enterprise');
  perform t.eq((select status from public.tenants where id = t.id('tenantA')), 'past_due', '[PLT-018] a large hotel also keeps working and has time to arrange payment');
  select body into v_body from public.notification_outbox where dedupe_key like 'trialend:%' limit 1;
  perform t.ok(v_body like '%Enterprise%' and v_body like '%hello@zikorahq.com%' and v_body !~ '(₦|NGN)', '[PLT-018] a large hotel is told to contact us for a quote, with no made-up price');
  update public.plans set max_rooms = 20 where code = 'starter';
  update public.plans set max_rooms = 60 where code = 'standard';
  update public.plans set max_rooms = 150 where code = 'pro';
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('large hotel', sqlerrm);
end $$;

-- The warnings before the trial ends name the plan and the price.
do $$
declare v_body text;
begin
  perform t.admin();
  perform t.set_tenant_status(t.id('tenantA'), 'trial');
  delete from public.notification_outbox;
  update public.tenant_subscriptions set trial_ends_at = now() + interval '5 days' where tenant_id = t.id('tenantA');
  perform app.run_subscription_clock();
  select body into v_body from public.notification_outbox where dedupe_key like 'trial7:%' limit 1;
  perform t.ok(v_body like '%Starter%' and v_body like '%₦30,000%' and v_body like '%14 days%' and v_body like '%hello@zikorahq.com%',
    '[PLT-018] the 7 day warning says which plan the hotel moves to, the price and the 14 days to pay');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('trial warning', sqlerrm);
end $$;

rollback;

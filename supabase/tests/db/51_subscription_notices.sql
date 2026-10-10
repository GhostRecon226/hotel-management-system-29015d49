-- Trial-ending and overdue-payment notices sent by the daily subscription clock (QA-05).
-- Recipients are the hotel's active System Administrators and General Managers.
begin;

create function t.notices(p_prefix text) returns integer language sql as $$
  select count(*)::int from public.notification_outbox
  where tenant_id = t.id('tenantA') and dedupe_key like p_prefix || ':%'
$$;

-- Trial notices.
do $$
declare v_subject text; v_body text; v_to text;
begin
  perform t.admin();
  perform t.set_tenant_status(t.id('tenantA'), 'trial');
  perform t.set_tenant_status(t.id('tenantB'), 'trial');
  delete from public.notification_outbox;
  update public.tenant_subscriptions set trial_ends_at = now() + interval '20 days' where tenant_id = t.id('tenantA');
  update public.tenant_subscriptions set trial_ends_at = now() + interval '20 days' where tenant_id = t.id('tenantB');
  perform app.run_subscription_clock();
  perform t.eq((select count(*)::int from public.notification_outbox), 0, '[PLT-014] no notice while the trial has more than 7 days left');

  update public.tenant_subscriptions set trial_ends_at = now() + interval '5 days' where tenant_id = t.id('tenantA');
  perform app.run_subscription_clock();
  perform t.eq(t.notices('trial7'), 2, '[PLT-014] seven days before the trial ends, each administrator gets one email');
  perform t.eq((select count(*)::int from public.notification_outbox where tenant_id = t.id('tenantB')), 0, '[PLT-014] another hotel gets nothing');
  select string_agg(recipient, ',' order by recipient) into v_to from public.notification_outbox where tenant_id = t.id('tenantA');
  perform t.eq(v_to, 'adminA@test.local,gm@test.local', '[PLT-014] only the System Administrator and General Manager are told');
  select subject, body into v_subject, v_body from public.notification_outbox where tenant_id = t.id('tenantA') limit 1;
  perform t.ok(v_body like '%hello@zikorahq.com%' and v_body like '%read-only%' and lower(v_body) like '%nothing is deleted%',
    '[PLT-014] the email says what happens, that nothing is deleted, and who to contact');
  perform t.ok(v_body not like '%—%' and v_subject not like '%—%' and v_body !~* '(₦|NGN|naira)', '[PLT-014] no em dash and no price in the email');

  perform app.run_subscription_clock();
  perform t.eq(t.notices('trial7'), 2, '[PLT-014] a second clock run sends nothing twice');

  update public.tenant_subscriptions set trial_ends_at = now() + interval '12 hours' where tenant_id = t.id('tenantA');
  perform app.run_subscription_clock();
  perform app.run_subscription_clock();
  perform t.eq(t.notices('trial1'), 2, '[PLT-014] one day before the trial ends, each administrator gets one more email');
  perform t.eq(t.notices('trial7'), 2, '[PLT-014] the seven day notice is not repeated');

  update public.tenant_subscriptions set trial_ends_at = now() - interval '1 hour' where tenant_id = t.id('tenantA');
  perform app.run_subscription_clock();
  perform app.run_subscription_clock();
  perform t.eq((select status from public.tenants where id = t.id('tenantA')), 'expired', '[PLT-014] the clock still expires the trial');
  perform t.eq(t.notices('trialend'), 2, '[PLT-014] when the trial ends, each administrator is told once');

  -- A hotel that converts before the date gets no notice.
  delete from public.notification_outbox;
  perform app.platform_set_subscription(t.id('tenantA'), 'trial', null, 'Back to trial for the test', null);
  update public.tenant_subscriptions set trial_ends_at = now() + interval '5 days' where tenant_id = t.id('tenantA');
  perform app.platform_set_subscription(t.id('tenantA'), 'active', now() + interval '30 days', 'Paid by transfer', null);
  perform app.run_subscription_clock();
  perform t.eq((select count(*)::int from public.notification_outbox where tenant_id = t.id('tenantA')), 0, '[PLT-014] a hotel that converted before the date gets no trial notice');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('trial notices', sqlerrm);
end $$;

-- Overdue notices.
do $$
begin
  perform t.admin();
  delete from public.notification_outbox;
  perform app.platform_set_subscription(t.id('tenantA'), 'active', now() + interval '30 days', 'Paid', null);
  perform app.run_subscription_clock();
  perform t.eq((select count(*)::int from public.notification_outbox where tenant_id = t.id('tenantA')), 0, '[PLT-015] a paid hotel gets no notice');

  update public.tenant_subscriptions set current_period_end = now() - interval '1 day' where tenant_id = t.id('tenantA');
  perform app.run_subscription_clock();
  perform app.run_subscription_clock();
  perform t.eq((select status from public.tenant_subscriptions where tenant_id = t.id('tenantA')), 'past_due', '[PLT-015] the clock still marks the unpaid hotel past due');
  perform t.eq(t.notices('pastdue'), 2, '[PLT-015] when payment is first overdue, each administrator is told once');
  perform t.eq(t.notices('pastdue3'), 0, '[PLT-015] no final warning yet');
  perform t.ok((select body like '%hello@zikorahq.com%' and body like '%read-only%' and body like '%to keep full access%' and body not like '%—%'
                from public.notification_outbox where dedupe_key like 'pastdue:%' limit 1), '[PLT-015] the overdue email says what to do and who to contact');

  update public.tenant_subscriptions set current_period_end = now() - interval '12 days' where tenant_id = t.id('tenantA');
  perform app.run_subscription_clock();
  perform app.run_subscription_clock();
  perform t.eq(t.notices('pastdue3'), 2, '[PLT-015] with 3 days of grace left, each administrator gets a final warning once');

  update public.tenant_subscriptions set current_period_end = now() - interval '15 days' where tenant_id = t.id('tenantA');
  perform app.run_subscription_clock();
  perform app.run_subscription_clock();
  perform t.eq((select status from public.tenants where id = t.id('tenantA')), 'suspended', '[PLT-015] the clock still suspends after the grace period');
  perform t.eq(t.notices('suspended'), 2, '[PLT-015] when the hotel is suspended, each administrator is told once');

  -- Paid before suspension: no notice.
  delete from public.notification_outbox;
  perform app.platform_set_subscription(t.id('tenantA'), 'past_due', null, 'Back to past due for the test', null);
  update public.tenant_subscriptions set current_period_end = now() - interval '12 days' where tenant_id = t.id('tenantA');
  perform app.platform_set_subscription(t.id('tenantA'), 'active', now() + interval '30 days', 'Paid by transfer', null);
  perform app.run_subscription_clock();
  perform t.eq((select count(*)::int from public.notification_outbox where tenant_id = t.id('tenantA')), 0, '[PLT-015] a hotel that paid before the date gets no overdue notice');

  -- A disabled administrator is not told.
  update public.profiles set status = 'disabled' where id = t.id('gm');
  update public.tenant_subscriptions set current_period_end = now() - interval '1 day' where tenant_id = t.id('tenantA');
  perform app.run_subscription_clock();
  perform t.eq(t.notices('pastdue'), 1, '[PLT-015] a disabled administrator is not emailed');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('overdue notices', sqlerrm);
end $$;

rollback;

-- Subscriptions, read-only hotels, plan limits, administration and guest privacy (ported from reference 15_accounts).
-- Findings M3 (settlement while read-only), M4 (subscription clock) and M5 (no personal data in the audit trail).
begin;

-- [M3] A read-only hotel can still settle and check out a guest already in house.
do $$
declare v_r uuid; v_f uuid; v_u uuid; v_n int;
begin
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('101'), null, null);
  v_f := t.main_folio(v_r);
  perform public.post_charge(v_f, t.cc('REST'), 10000, false, 'Dinner', null, 'ro-chg');
  v_u := t.book(t.id('g2'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  perform public.check_in(v_u, t.reg(), t.room('102'), null, null);
  perform public.post_charge(t.main_folio(v_u), t.cc('REST'), 5000, false, 'Lunch', null, 'ro-chg2');
  perform t.admin();
  perform t.set_tenant_status(t.id('tenantA'), 'expired');

  perform t.login('fdo');
  perform t.raises(format('select public.post_charge(%L, %L, 100, false, %L, null, %L)', v_f, t.cc('REST'), 'x', 'ro-chg3'), 'E_READ_ONLY', '[PLT-005] expired account cannot post charges');
  perform t.raises(format('select t.book(%L, %L, %L, %L, %L)', t.id('g3'), t.bdate() + 5, t.bdate() + 6, t.id('std'), t.id('bar')), 'E_READ_ONLY', '[PLT-005] expired account cannot book');
  select count(*) into v_n from public.reservations; perform t.ok(v_n >= 2, '[PLT-005] but the data is still readable');
  perform t.raises(format('select public.save_guest(null, %L, %L, null, null, null, null, null)', 'New', 'Guest'), 'E_READ_ONLY', '[PLT-005] expired account cannot add guests');
  perform t.login('adminA');
  perform t.raises(format('select public.save_room(%L, null, %L, %L, %L, true)', t.id('propA'), '150', t.id('std'), '1'), 'E_READ_ONLY', '[PLT-005] expired account cannot add rooms');
  perform t.login('fdo');
  perform t.lives(format('select public.post_payment(%L, %L, %s, %L, false, null, null, %L)', v_f, t.pm('CASH'), public.checkout_outstanding(v_r), 'NGN', 'ro-pay'),
    '[M3][PLT-006] an in-house guest can still pay');
  perform t.lives(format('select public.check_out(%L, null, null)', v_r), '[M3][PLT-006] and check out');
  perform t.login('fom');
  perform t.lives(format('select public.check_out(%L, null, %L)', v_u, 'Pays by transfer'), '[M3][PLT-006] a manager can check out a guest who owes, with a reason');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('read-only settlement', sqlerrm);
end $$;

-- [M4] The daily subscription clock and manual activation (decision 5e).
do $$
declare v_n int; v_h int;
begin
  perform t.admin();
  perform t.set_tenant_status(t.id('tenantA'), 'trial');
  perform t.set_tenant_status(t.id('tenantB'), 'trial');
  update public.tenant_subscriptions set trial_ends_at = now() - interval '1 day' where tenant_id = t.id('tenantA');
  update public.tenant_subscriptions set trial_ends_at = now() + interval '10 days' where tenant_id = t.id('tenantB');
  v_n := app.run_subscription_clock();
  perform t.eq(v_n, 1, '[M4][PLT-005] the daily clock expired one trial');
  perform t.eq((select status from public.tenants where id = t.id('tenantA')), 'expired', '[M4][PLT-005] trial is expired and the hotel is read-only');
  perform t.eq((select status from public.tenant_subscriptions where tenant_id = t.id('tenantA')), 'expired', '[M4] the subscription shows expired');
  perform t.eq((select status from public.tenants where id = t.id('tenantB')), 'trial', '[M4] a hotel still in its trial is untouched');
  perform t.ok(exists (select 1 from public.subscription_history where tenant_id = t.id('tenantA') and to_status = 'expired'), '[M4][PLT-005] the change is in the subscription history');
  perform t.ok(exists (select 1 from cron.job where jobname = 'subscription-clock'), '[M4] the clock is scheduled daily');

  perform t.login('adminA');
  perform t.raises(format('select app.platform_set_subscription(%L, %L, %L, %L, null)', t.id('tenantA'), 'active', now() + interval '30 days', 'x'),
    'permission denied', '[PLT-008] a hotel cannot activate itself');
  perform t.admin();
  perform t.raises(format('select app.platform_set_subscription(%L, %L, %L, %L, null)', t.id('tenantA'), 'active', now() + interval '30 days', ''), 'E_REQUIRED', '[PLT-008] a reason is required');
  perform t.raises(format('select app.platform_set_subscription(%L, %L, %L, %L, null)', t.id('tenantA'), 'active', now() - interval '1 day', 'Paid'), 'E_INVALID', '[PLT-008] the paid period must end in the future');
  perform app.platform_set_subscription(t.id('tenantA'), 'active', now() + interval '30 days', 'Invoice 001 paid by transfer', null);
  perform t.eq((select status from public.tenants where id = t.id('tenantA')), 'active', '[PLT-008] platform staff activated a paid hotel');
  perform t.login('fdo');
  perform t.lives(format('select t.book(%L, %L, %L, %L, %L)', t.id('g3'), t.bdate() + 5, t.bdate() + 6, t.id('std'), t.id('bar')), '[PLT-008] the hotel can work again once active');
  perform t.admin();
  perform app.platform_set_subscription(t.id('tenantA'), 'suspended', null, 'Chargeback', null);
  perform t.login('fdo');
  perform t.raises(format('select t.book(%L, %L, %L, %L, %L)', t.id('g3'), t.bdate() + 7, t.bdate() + 8, t.id('std'), t.id('bar')), 'E_READ_ONLY', '[PLT-008] a suspended hotel is read-only');
  perform t.admin();
  select count(*) into v_h from public.subscription_history where tenant_id = t.id('tenantA');
  perform t.ok(v_h >= 3, '[PLT-008] every state change left a history row');

  -- [D7] Unpaid period becomes past due; after 14 days grace the hotel is suspended.
  perform app.platform_set_subscription(t.id('tenantA'), 'active', now() + interval '30 days', 'Paid again', null);
  update public.tenant_subscriptions set current_period_end = now() - interval '1 day' where tenant_id = t.id('tenantA');
  perform app.run_subscription_clock();
  perform t.eq((select status from public.tenant_subscriptions where tenant_id = t.id('tenantA')), 'past_due', '[D7] unpaid period becomes past due');
  perform t.login('fdo');
  perform t.lives(format('select t.book(%L, %L, %L, %L, %L)', t.id('g3'), t.bdate() + 9, t.bdate() + 10, t.id('std'), t.id('bar')), '[D7] past due keeps working during the grace period');
  perform t.admin();
  update public.tenant_subscriptions set current_period_end = now() - interval '15 days' where tenant_id = t.id('tenantA');
  perform app.run_subscription_clock();
  perform t.eq((select status from public.tenants where id = t.id('tenantA')), 'suspended', '[D7] after 14 days grace the hotel is suspended');

  -- [PLT-011] A hotel can cancel its own subscription and is read-only once the paid period ends.
  perform app.platform_set_subscription(t.id('tenantA'), 'active', now() + interval '30 days', 'Paid again', null);
  perform t.login('fdo');
  perform t.raises(format('select public.cancel_subscription(%L)', 'Too expensive'), 'E_FORBIDDEN', '[PLT-011] front desk cannot cancel the subscription');
  perform t.login('adminA');
  perform t.lives(format('select public.cancel_subscription(%L)', 'Too expensive'), '[PLT-011] the hotel can cancel its own subscription');
  perform t.eq((select status from public.tenant_subscriptions where tenant_id = t.id('tenantA')), 'cancelled', '[PLT-011] status becomes cancelled');
  perform t.lives(format('select t.book(%L, %L, %L, %L, %L)', t.id('g3'), t.bdate() + 11, t.bdate() + 12, t.id('std'), t.id('bar')), '[PLT-011] it keeps working until the paid period ends');
  perform t.admin();
  update public.tenant_subscriptions set current_period_end = now() - interval '1 day' where tenant_id = t.id('tenantA');
  perform app.run_subscription_clock();
  perform t.login('adminA');
  perform t.raises(format('select t.book(%L, %L, %L, %L, %L)', t.id('g3'), t.bdate() + 13, t.bdate() + 14, t.id('std'), t.id('bar')), 'E_READ_ONLY', '[PLT-011] a cancelled account is read-only after the paid period');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('subscription clock', sqlerrm);
end $$;

-- Plan limits (PLT-007).
do $$
declare v_u uuid := gen_random_uuid();
begin
  perform t.admin();
  perform t.set_tenant_status(t.id('tenantA'), 'active');
  update public.tenant_subscriptions set plan_code = 'starter' where tenant_id = t.id('tenantA');
  perform t.login('adminA');
  perform public.bulk_add_rooms(t.id('propA'), 105, 120, t.id('std'), '1');
  perform t.raises(format('select public.save_room(%L, null, %L, %L, %L, true)', t.id('propA'), '121', t.id('std'), '1'), 'E_PLAN_LIMIT', '[PLT-007] the room limit of the plan is enforced');
  perform t.admin();
  insert into auth.users (id, email, email_confirmed_at, aud, role) values (v_u, 'extra@test.local', now(), 'authenticated', 'authenticated');
  perform t.login('adminA');
  perform t.raises(format('select public.register_invited_user(%L, %L, null)', v_u, 'Extra'), 'E_PLAN_LIMIT', '[PLT-007] the user limit of the plan is enforced');
  perform t.ok(exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname in ('create_property', 'add_property')),
    '[PLT-007] a hotel can add another property (so the property limit can apply)');
  perform t.admin();
  update public.tenant_subscriptions set plan_code = 'standard' where tenant_id = t.id('tenantA');
  perform t.login('adminA');
  perform public.save_room(t.id('propA'), null, '121', t.id('std'), '1', true);
  perform t.admin();
  perform t.raises(format('select app.platform_set_subscription(%L, %L, %L, %L, %L)', t.id('tenantA'), 'active', now() + interval '30 days', 'Downgrade', 'starter'),
    'E_PLAN_LIMIT', '[PLT-007] a hotel cannot be moved to a plan smaller than what it uses');
  update public.tenant_subscriptions set plan_code = 'standard' where tenant_id = t.id('tenantA');
exception when others then perform t.admin(); perform t.crash('plan limits', sqlerrm);
end $$;

-- Administration rules.
do $$
declare v_sys uuid := (select id from public.roles where tenant_id is null and code = 'SYSADMIN');
begin
  perform t.admin(); perform t.set_tenant_status(t.id('tenantA'), 'active');
  perform t.login('adminA');
  perform t.raises(format('select public.remove_role(%L, %L, %L)', t.id('adminA'), t.id('propA'), v_sys), 'E_LAST_SYSADMIN|E_LAST_ADMIN', '[ADM-002] the last system administrator cannot be removed');
  perform t.raises(format('select public.set_user_status(%L, %L)', t.id('adminA'), 'disabled'), 'E_LAST_SYSADMIN|E_LAST_ADMIN|E_INVALID|E_FORBIDDEN', '[ADM-002] you cannot deactivate yourself');
  perform t.raises(format('select public.assign_role(%L, %L, %L)', t.id('adminB'), t.id('propA'), (select id from public.roles where tenant_id is null and code = 'FDO')),
    'E_NOT_FOUND|E_TENANT_MISMATCH', '[ADM-002] a hotel cannot assign roles to another hotel''s user');
  perform t.raises(format($q$select public.set_role_permissions(%L, '[{"key":"fo.view"}]'::jsonb)$q$, (select id from public.roles where tenant_id is null and code = 'FDO')),
    'E_SYSTEM_ROLE|E_NOT_FOUND', '[ADM-004] system roles cannot be edited');
  perform public.set_user_status(t.id('csh'), 'disabled');
  perform t.login('csh');
  perform t.raises(format('select public.post_charge(%L, %L, 100, false, %L, null, %L)', gen_random_uuid(), t.cc('REST'), 'x', 'dis-1'),
    'E_FORBIDDEN|E_NOT_FOUND', '[ADM-003] a deactivated user cannot act, and is told they have no access (not that the subscription expired)');
  perform t.admin();
  perform t.ok(exists (select 1 from public.audit_events where record_id = t.id('csh')::text and table_name = 'profiles'), '[ADM-003] user status changes are audited');
exception when others then perform t.admin(); perform t.crash('administration', sqlerrm);
end $$;

-- [M5] Guest privacy.
do $$
declare v_doc uuid; v_r uuid; v_n int;
begin
  perform t.login('fdo');
  perform public.save_guest(t.id('g1'), 'Chinedu', 'Okafor', '08099990000', 'chinedu@example.ng', 'NG', null, null);
  v_doc := public.save_guest_document(null, t.id('g1'), 'passport', 'B7654321', null);
  perform t.admin();
  perform t.ok(not exists (select 1 from public.audit_events where table_name in ('guests', 'guest_documents')
    and (coalesce(before::text, '') || coalesce(after::text, '')) ~ '(0809999|08030000001|B7654321|A1234567|chinedu@example)'),
    '[M5][GST-003] guest audit records field names, not phone numbers, emails or ID numbers');
  perform t.ok(exists (select 1 from public.audit_events where table_name = 'guests' and record_id = t.id('g1')::text
    and after::text ~ 'phone'), '[M5][GST-003] but it records that the phone number changed');
  perform t.login('hks');
  perform t.raises(format('select * from public.search_guests(%L, 10)', 'Okafor'), 'E_FORBIDDEN', '[GST-001] housekeeping cannot search guests');
  perform t.login('fdo');
  perform t.ok((select count(*) from public.search_guests('Okafor', 10)) = 1, '[GST-001] front desk can search guests');
  perform t.raises(format('select public.anonymise_guest(%L, %L)', t.id('g3'), 'Request'), 'E_FORBIDDEN', '[GST-005] front desk cannot anonymise a guest');
  v_r := t.book(t.id('g3'), t.bdate() + 3, t.bdate() + 4, t.id('std'), t.id('bar'));
  perform public.open_main_folio(v_r);
  perform t.login('fom');
  perform public.merge_guests(t.id('g2'), t.id('g3'), 'Same person');
  perform t.eq((select guest_id from public.reservations where id = v_r), t.id('g2'), '[GST-004] the merged guest''s reservations moved to the kept profile');
  perform t.eq((select guest_id from public.folios where reservation_id = v_r and is_main), t.id('g2'), '[GST-004] and their folios');
  perform t.ok((select merged_into = t.id('g2') from public.guests where id = t.id('g3')), '[GST-004] the duplicate points to the kept profile');
  perform t.login('gm');
  perform t.raises(format('select public.anonymise_guest(%L, %L)', t.id('g2'), 'Request'), 'E_INVALID|E_IN_USE', '[GST-005] a guest with upcoming stays cannot be anonymised');
  -- cancel every booking of theirs that is not over (earlier tests booked this guest too)
  perform public.cancel_reservation(r.id, 'Guest asked', true, 'Anonymisation')
  from public.reservations r where r.guest_id = t.id('g2') and r.status in ('tentative', 'confirmed');
  perform public.anonymise_guest(t.id('g2'), 'Guest asked to be forgotten');
  perform t.eq((select first_name from public.guests where id = t.id('g2')), 'Anonymised', '[GST-005] personal data is removed');
  perform t.ok((select phone is null and email is null from public.guests where id = t.id('g2')), '[GST-005] contact details are gone');
  perform t.ok(exists (select 1 from public.reservations where id = v_r), '[GST-005] reservation history is kept');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('guest privacy', sqlerrm);
end $$;

-- [GST-005] Anonymising is refused while the guest has a stay that is not over.
do $$
declare v_g uuid; v_r uuid;
begin
  perform t.login('adminA');
  perform public.save_room(t.id('propA'), null, '190', t.id('std'), '1', true);
  perform t.login('fdo');
  v_g := public.save_guest(null, 'Future', 'Guest', '08030000077', null, 'NG', null, null);
  v_r := t.book(v_g, t.bdate() + 10, t.bdate() + 12, t.id('std'), t.id('bar'), null, 'tentative');
  perform t.login('gm');
  perform t.raises(format('select public.anonymise_guest(%L, %L)', v_g, 'Request'), 'E_IN_USE', '[GST-005] a guest with a tentative future booking cannot be anonymised');
  perform public.cancel_reservation(v_r, 'Guest asked', true, 'Anonymisation');
  perform t.login('fdo');
  v_r := t.book(v_g, t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('190'), null, null);
  perform t.login('gm');
  perform t.raises(format('select public.anonymise_guest(%L, %L)', v_g, 'Request'), 'E_IN_USE', '[GST-005] a guest who is in house cannot be anonymised');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('anonymise guard', sqlerrm);
end $$;

rollback;

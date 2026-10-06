-- Platform console (wave 2, item 2, decisions of 6 Oct 2026). Platform operators are separate sign-ins that belong to
-- no hotel. Every platform function checks the operator list AND that the session passed two-step sign-in (aal2).
-- Operators see hotel account data only (no guests, bookings or money) and every change is logged.
begin;

-- Act as any user with a chosen assurance level (aal1 = password only, aal2 = two-step sign-in passed).
create function t.as_user(p_user uuid, p_aal text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', p_user::text, false);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, false);
  execute 'set role authenticated';
end $$;
create function t.history_count(p_tenant uuid) returns integer language sql stable security definer as $$
  select count(*)::int from public.subscription_history where tenant_id = p_tenant $$;
grant execute on function t.as_user(uuid, text), t.history_count(uuid) to authenticated;

-- Adding operators: only the database owner (Supabase SQL editor), only accounts that belong to no hotel.
do $$
declare v_op uuid := gen_random_uuid(); v_op2 uuid := gen_random_uuid();
begin
  perform t.admin();
  insert into auth.users (id, email, email_confirmed_at, aud, role) values
    (v_op, 'operator@platform.test', now(), 'authenticated', 'authenticated'),
    (v_op2, 'second@platform.test', now(), 'authenticated', 'authenticated');
  perform t.put('op', v_op); perform t.put('op2', v_op2);
  perform t.raises($q$select app.add_platform_operator('nobody@platform.test')$q$, 'E_NOT_FOUND', '[PLT-013] an unknown email is refused');
  perform t.raises(format('select app.add_platform_operator(%L)', (select email from auth.users where id = t.id('adminA'))),
    'E_INVALID', '[PLT-013] an account that belongs to a hotel cannot be an operator');
  perform app.add_platform_operator('Operator@Platform.test ');
  perform t.ok(exists (select 1 from app.platform_operators where user_id = v_op), '[PLT-013] the owner adds an operator by email');
  perform app.add_platform_operator('operator@platform.test');
  perform t.eq((select count(*)::int from app.platform_operators where user_id = v_op), 1, '[PLT-013] adding the same operator twice keeps one row');
  perform t.login('adminA');
  perform t.raises($q$select app.add_platform_operator('second@platform.test')$q$, 'permission denied', '[PLT-013] a hotel administrator cannot add operators');
  perform t.raises($q$select count(*) from app.platform_operators$q$, 'permission denied', '[PLT-013] nor read the operator list');
  perform t.admin();
end $$;

-- Two-step sign-in and the operator list are checked by the database, not only by the screen.
do $$
declare j jsonb;
begin
  perform t.as_user(t.id('op'), 'aal1');
  j := public.platform_whoami();
  perform t.ok((j->>'operator')::boolean and not (j->>'mfa')::boolean, '[PLT-013] a password-only operator session is recognised but not yet verified');
  perform t.raises('select * from public.platform_list_tenants()', 'E_MFA_REQUIRED', '[PLT-013] a password-only operator session is refused');
  perform t.raises(format('select public.platform_change_subscription(%L, %L, %L, %L, null)', t.id('tenantB'), 'suspend', 'Test', null),
    'E_MFA_REQUIRED', '[PLT-013] and cannot change a hotel');
  perform t.as_user(t.id('op2'), 'aal2');
  perform t.raises('select * from public.platform_list_tenants()', 'E_FORBIDDEN', '[PLT-013] two-step sign-in alone is not enough: the account must be on the operator list');
  perform t.as_user(t.id('adminA'), 'aal2');
  perform t.ok(not (public.platform_whoami()->>'operator')::boolean, '[PLT-013] a hotel administrator is not an operator');
  perform t.raises('select * from public.platform_list_tenants()', 'E_FORBIDDEN', '[PLT-013] a hotel administrator is refused, even with two-step sign-in');
  perform t.anon();
  perform t.raises('select * from public.platform_list_tenants()', 'permission denied', '[PLT-013] signed-out visitors cannot call it');
  perform t.admin();
end $$;

-- Operators see hotel account data only.
do $$
declare r record; v_cols text;
begin
  perform t.as_user(t.id('op'), 'aal2');
  select * into r from public.platform_list_tenants() where tenant_id = t.id('tenantA');
  perform t.ok(r.tenant_id is not null and r.properties >= 1 and r.rooms >= 1 and r.active_users >= 1, '[PLT-009] the operator sees each hotel with its counts');
  perform t.eq(r.plan_code, 'standard', '[PLT-009] and its plan');
  perform t.ok((select count(*) from public.platform_list_tenants()) >= 2, '[PLT-009] every hotel is listed');
  perform t.eq((select count(*)::int from public.guests), 0, '[PLT-009] an operator reads no guests');
  perform t.eq((select count(*)::int from public.reservations), 0, '[PLT-009] no bookings');
  perform t.eq((select count(*)::int from public.folio_transactions), 0, '[PLT-009] and no money');
  perform t.admin();
  select pg_get_function_result('public.platform_list_tenants()'::regprocedure) into v_cols;
  perform t.ok(v_cols !~* 'guest|revenue|balance|amount|email|phone', '[PLT-009] the hotel list has no guest, money or contact columns: ' || v_cols);
  perform t.login('op');
  perform t.raises($q$select public.create_hotel('Op Hotel', 'Nigeria', 'Op Hotel', 'Op', 'Lagos')$q$, 'E_FORBIDDEN', '[PLT-013] an operator account cannot join or create a hotel');
  perform t.admin();
end $$;

-- Changes: each needs a reason, is checked, and leaves a history row naming the operator.
do $$
declare v_h int; h record; v_until timestamptz := date_trunc('day', now()) + interval '45 days';
begin
  perform t.admin();
  perform t.set_tenant_status(t.id('tenantB'), 'trial');
  update public.tenant_subscriptions set trial_ends_at = now() + interval '3 days' where tenant_id = t.id('tenantB');
  v_h := t.history_count(t.id('tenantB'));
  perform t.as_user(t.id('op'), 'aal2');
  perform t.raises(format('select public.platform_change_subscription(%L, %L, %L, %L, null)', t.id('tenantB'), 'extend_trial', '', now() + interval '20 days'),
    'E_REQUIRED', '[PLT-008] a reason is required');
  perform t.raises(format('select public.platform_change_subscription(%L, %L, %L, %L, null)', t.id('tenantB'), 'extend_trial', 'Demo', now() - interval '1 day'),
    'E_INVALID', '[PLT-008] a new trial end must be in the future');
  perform t.raises(format('select public.platform_change_subscription(%L, %L, %L, %L, null)', t.id('tenantB'), 'extend_trial', 'Demo', now() + interval '400 days'),
    'E_INVALID', '[PLT-008] a trial can be extended by at most a year at a time');
  perform public.platform_change_subscription(t.id('tenantB'), 'extend_trial', 'Demo hotel stays open for sales visits', now() + interval '20 days', null);
  perform t.admin();
  perform t.ok((select trial_ends_at::date = (now() + interval '20 days')::date and status = 'trial' from public.tenant_subscriptions where tenant_id = t.id('tenantB')),
    '[PLT-008] extending a trial moves its end date and keeps it a trial');
  perform t.eq(t.history_count(t.id('tenantB')), v_h + 1, '[PLT-008] and is logged');

  perform t.as_user(t.id('op'), 'aal2');
  perform t.raises(format('select public.platform_change_subscription(%L, %L, %L, %L, null)', t.id('tenantB'), 'activate', 'Paid', now() - interval '1 day'),
    'E_INVALID', '[PLT-008] activation needs a paid-until date in the future');
  perform public.platform_change_subscription(t.id('tenantB'), 'activate', 'Invoice 001 paid by transfer', v_until, 'starter');
  perform t.admin();
  perform t.ok((select t2.status = 'active' and s.status = 'active' and s.current_period_end = v_until and s.plan_code = 'starter'
    from public.tenants t2 join public.tenant_subscriptions s on s.tenant_id = t2.id where t2.id = t.id('tenantB')),
    '[PLT-008] activation sets the status, the paid-until date and the plan');
  select * into h from public.subscription_history where tenant_id = t.id('tenantB') and reason = 'Invoice 001 paid by transfer';
  perform t.ok(h.source = 'platform' and h.actor_id = t.id('op') and h.reason = 'Invoice 001 paid by transfer' and h.to_status = 'active',
    '[PLT-008] the history row names the operator, the reason and the new status');

  perform t.as_user(t.id('op'), 'aal2');
  perform t.raises(format('select public.platform_change_subscription(%L, %L, %L, %L, %L)', t.id('tenantB'), 'activate', 'Again', v_until, 'starter'),
    'E_INVALID', '[PLT-008] repeating the same change is refused (nothing to change)');
  perform t.raises(format('select public.platform_change_subscription(%L, %L, %L, null, null)', t.id('tenantB'), 'delete', 'x'),
    'E_INVALID', '[PLT-008] unknown actions are refused');
  perform public.platform_change_subscription(t.id('tenantB'), 'suspend', 'Chargeback on invoice 001', null, null);
  perform t.admin();
  perform t.ok(not app.tenant_writable(t.id('tenantB')), '[PLT-008] a suspended hotel is read-only');
  perform t.as_user(t.id('op'), 'aal2');
  perform public.platform_change_subscription(t.id('tenantB'), 'activate', 'Chargeback resolved', v_until, null);
  perform t.admin();
  perform t.ok(app.tenant_writable(t.id('tenantB')), '[PLT-008] and works again once reactivated');

  insert into public.plans(code, name, max_rooms, max_properties, max_users) values ('tiny', 'Tiny (test only)', 1, 1, 1);
  perform t.as_user(t.id('op'), 'aal2');
  perform t.raises(format('select public.platform_change_subscription(%L, %L, %L, null, %L)', t.id('tenantA'), 'change_plan', 'Downgrade', 'tiny'),
    'E_PLAN_LIMIT', '[PLT-008] a hotel cannot be moved to a plan smaller than what it uses');
  perform public.platform_change_subscription(t.id('tenantB'), 'change_plan', 'Upgrade on request', null, 'pro');
  perform t.admin();
  perform t.eq((select plan_code from public.tenant_subscriptions where tenant_id = t.id('tenantB')), 'pro', '[PLT-008] the plan can be changed');
  perform t.as_user(t.id('op'), 'aal2');
  perform public.platform_change_subscription(t.id('tenantB'), 'cancel', 'Hotel closed', null, null);
  perform t.ok(exists (select 1 from public.platform_tenant_history(t.id('tenantB')) x where x.reason = 'Hotel closed' and x.operator_email = 'operator@platform.test'),
    '[PLT-008] the operator sees the history with who made each change');
  perform t.admin();
  perform t.eq((select status from public.tenants where id = t.id('tenantB')), 'cancelled', '[PLT-008] a hotel can be cancelled; nothing is deleted');
end $$;

rollback;

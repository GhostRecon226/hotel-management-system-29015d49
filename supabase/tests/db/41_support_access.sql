-- Support access with the hotel's consent (PLT-010). A platform operator asks, with a reason. The hotel's
-- administrator says yes for a set number of hours, or no. Only then can the operator open a read-only
-- support view of the hotel: setup, business date runs and message counts, never guests, bookings or money.
-- Every step is in the hotel's audit log and the hotel is told.
begin;

create function t.as_user(p_user uuid, p_aal text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', p_user::text, false);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, false);
  execute 'set role authenticated';
end $$;
grant execute on function t.as_user(uuid, text) to authenticated;

do $$
declare v_op uuid := gen_random_uuid(); v_op2 uuid := gen_random_uuid();
begin
  perform t.admin();
  insert into auth.users (id, email, email_confirmed_at, aud, role) values
    (v_op, 'support1@platform.test', now(), 'authenticated', 'authenticated'),
    (v_op2, 'support2@platform.test', now(), 'authenticated', 'authenticated');
  perform app.add_platform_operator('support1@platform.test');
  perform app.add_platform_operator('support2@platform.test');
  perform t.put('op', v_op); perform t.put('op2', v_op2);
end $$;

-- Asking: operators only, two-step sign-in, a reason, a sensible length of time.
do $$
declare v_id uuid; v_n int;
begin
  perform t.as_user(t.id('op'), 'aal1');
  perform t.raises(format('select public.platform_request_support_access(%L, %L, 4)', t.id('tenantA'), 'Night audit fails'),
    'E_MFA_REQUIRED', '[PLT-010] a password-only operator session cannot ask for support access');
  perform t.as_user(t.id('adminA'), 'aal2');
  perform t.raises(format('select public.platform_request_support_access(%L, %L, 4)', t.id('tenantA'), 'Let me in'),
    'E_FORBIDDEN', '[PLT-010] a hotel administrator cannot ask for platform support access');
  perform t.anon();
  perform t.raises(format('select public.platform_request_support_access(%L, %L, 4)', t.id('tenantA'), 'x'),
    'permission denied', '[PLT-010] a signed-out visitor cannot ask');
  perform t.as_user(t.id('op'), 'aal2');
  perform t.raises(format('select public.platform_request_support_access(%L, %L, 4)', t.id('tenantA'), '  '),
    'E_REQUIRED', '[PLT-010] a reason is required');
  perform t.raises(format('select public.platform_request_support_access(%L, %L, 0)', t.id('tenantA'), 'Night audit fails'),
    'E_INVALID', '[PLT-010] zero hours is refused');
  perform t.raises(format('select public.platform_request_support_access(%L, %L, 100)', t.id('tenantA'), 'Night audit fails'),
    'E_INVALID', '[PLT-010] more than 72 hours is refused');
  perform t.raises(format('select public.platform_request_support_access(%L, %L, 4)', gen_random_uuid(), 'Night audit fails'),
    'E_NOT_FOUND', '[PLT-010] an unknown hotel is refused');
  v_id := public.platform_request_support_access(t.id('tenantA'), 'Night audit fails every night', 4);
  perform t.put('req', v_id);
  perform t.raises(format('select public.platform_request_support_access(%L, %L, 4)', t.id('tenantA'), 'Again'),
    'E_INVALID', '[PLT-010] a second open request for the same hotel is refused');
  perform t.admin();
  perform t.ok(exists (select 1 from public.audit_events where tenant_id = t.id('tenantA') and action = 'support_access_requested'
    and actor_id = t.id('op') and reason = 'Night audit fails every night'), '[PLT-010] the request is in the hotel audit log with the reason');
  perform t.ok(exists (select 1 from public.notifications where tenant_id = t.id('tenantA') and user_id = t.id('adminA') and kind = 'support_access_requested'),
    '[PLT-010] the hotel administrator is told');
  select count(*)::int into v_n from public.notifications where tenant_id = t.id('tenantA') and user_id = t.id('fdo') and kind = 'support_access_requested';
  perform t.eq(v_n, 0, '[PLT-010] staff who cannot decide are not told');
end $$;

-- Before consent the operator gets nothing.
do $$
begin
  perform t.as_user(t.id('op'), 'aal2');
  perform t.raises(format('select public.platform_support_snapshot(%L)', t.id('tenantA')), 'E_NO_CONSENT',
    '[PLT-010] no support view while the request is waiting');
  perform t.admin();
end $$;

-- Only the right person at the right hotel can decide.
do $$
begin
  perform t.login('fdo');
  perform t.raises('select * from public.list_support_access()', 'E_FORBIDDEN', '[PLT-010] front desk staff cannot see support requests');
  perform t.raises(format('select public.decide_support_access(%L, true, 2)', t.id('req')), 'E_FORBIDDEN', '[PLT-010] nor decide them');
  perform t.login('adminB');
  perform t.eq((select count(*)::int from public.list_support_access()), 0, '[PLT-010] another hotel does not see the request');
  perform t.raises(format('select public.decide_support_access(%L, true, 2)', t.id('req')), 'E_NOT_FOUND', '[PLT-010] nor decide it');
  perform t.login('adminA');
  perform t.eq((select count(*)::int from public.list_support_access() where status = 'requested' and requested_by_email = 'support1@platform.test'), 1,
    '[PLT-010] the hotel administrator sees who asked');
  perform t.admin();
end $$;

-- Saying no.
do $$
declare v_id uuid;
begin
  perform t.login('adminA');
  perform public.decide_support_access(t.id('req'), false, null);
  perform t.eq((select status from public.list_support_access() where id = t.id('req')), 'denied', '[PLT-010] the hotel can say no');
  perform t.raises(format('select public.decide_support_access(%L, true, 2)', t.id('req')), 'E_INVALID', '[PLT-010] a decision cannot be changed afterwards');
  perform t.as_user(t.id('op'), 'aal2');
  perform t.raises(format('select public.platform_support_snapshot(%L)', t.id('tenantA')), 'E_NO_CONSENT', '[PLT-010] a refused request gives no access');
  v_id := public.platform_request_support_access(t.id('tenantA'), 'Second attempt after the first was refused', 6);
  perform t.put('req2', v_id);
  perform t.admin();
  perform t.ok(exists (select 1 from public.audit_events where tenant_id = t.id('tenantA') and action = 'support_access_denied'), '[PLT-010] the refusal is in the audit log');
end $$;

-- Saying yes: time-boxed, per operator, read-only, no personal data.
do $$
declare j jsonb; v_exp timestamptz; v_views int;
begin
  perform t.login('adminA');
  perform t.raises(format('select public.decide_support_access(%L, true, 100)', t.id('req2')), 'E_INVALID', '[PLT-010] the hotel cannot grant more than 72 hours');
  perform public.decide_support_access(t.id('req2'), true, 3);
  perform t.admin();
  select expires_at into v_exp from public.support_access_grants where id = t.id('req2');
  perform t.ok(v_exp > now() + interval '2 hours 55 minutes' and v_exp < now() + interval '3 hours 5 minutes', '[PLT-010] access lasts for the hours the hotel chose');
  perform t.as_user(t.id('op'), 'aal2');
  j := public.platform_support_snapshot(t.id('tenantA'));
  perform t.ok(j ? 'hotel' and j ? 'properties' and j ? 'business_date_runs' and j ? 'messages', '[PLT-010] the operator can open the support view');
  perform t.ok(j::text !~* 'Okafor|chinedu|08030000001|Bello|A1234567', '[PLT-010] the support view holds no guest names, contacts or ID numbers');
  perform t.ok(j::text !~* 'folio|balance|amount', '[PLT-010] and no money');
  perform t.as_user(t.id('op2'), 'aal2');
  perform t.raises(format('select public.platform_support_snapshot(%L)', t.id('tenantA')), 'E_NO_CONSENT', '[PLT-010] the grant belongs to the operator who asked, not to other operators');
  perform t.as_user(t.id('op'), 'aal2');
  perform t.raises(format('select public.platform_support_snapshot(%L)', t.id('tenantB')), 'E_NO_CONSENT', '[PLT-010] and to that hotel only');
  perform t.admin();
  select views into v_views from public.support_access_grants where id = t.id('req2');
  perform t.eq(v_views, 1, '[PLT-010] each view is counted');
  perform t.ok((select count(*) from public.audit_events where tenant_id = t.id('tenantA') and action = 'support_access_viewed' and actor_id = t.id('op')) = 1,
    '[PLT-010] and each view is in the hotel audit log');
  perform t.ok(exists (select 1 from public.audit_events where tenant_id = t.id('tenantA') and action = 'support_access_granted' and actor_id = t.id('adminA')),
    '[PLT-010] the grant is in the audit log with who granted it');
  perform t.login('adminA');
  perform t.ok(exists (select 1 from public.list_support_access() where id = t.id('req2') and status = 'granted' and views = 1),
    '[PLT-010] the hotel sees the access is open and how often it was used');
  perform t.admin();
end $$;

-- The operator cannot reach hotel tables through this access.
do $$
begin
  perform t.as_user(t.id('op'), 'aal2');
  perform t.eq((select count(*)::int from public.guests), 0, '[PLT-010] support access does not open the guest list');
  perform t.eq((select count(*)::int from public.reservations), 0, '[PLT-010] nor bookings');
  perform t.eq((select count(*)::int from public.folio_transactions), 0, '[PLT-010] nor money');
  perform t.raises('select count(*) from public.support_access_grants', 'permission denied', '[PLT-010] the grants table cannot be read or edited directly');
  perform t.admin();
end $$;

-- The hotel can stop it at once.
do $$
begin
  perform t.login('fdo');
  perform t.raises(format('select public.revoke_support_access(%L)', t.id('req2')), 'E_FORBIDDEN', '[PLT-010] front desk staff cannot stop support access');
  perform t.login('adminA');
  perform public.revoke_support_access(t.id('req2'));
  perform t.as_user(t.id('op'), 'aal2');
  perform t.raises(format('select public.platform_support_snapshot(%L)', t.id('tenantA')), 'E_NO_CONSENT', '[PLT-010] after the hotel stops it, the support view is closed');
  perform t.admin();
  perform t.ok(exists (select 1 from public.audit_events where tenant_id = t.id('tenantA') and action = 'support_access_revoked'), '[PLT-010] stopping it is in the audit log');
  perform t.login('adminA');
  perform t.raises(format('select public.revoke_support_access(%L)', t.id('req2')), 'E_INVALID', '[PLT-010] a closed grant cannot be stopped twice');
  perform t.admin();
end $$;

-- Time runs out by itself.
do $$
declare v_id uuid;
begin
  perform t.as_user(t.id('op'), 'aal2');
  v_id := public.platform_request_support_access(t.id('tenantA'), 'Third visit', 2);
  perform t.login('adminA');
  perform public.decide_support_access(v_id, true, 1);
  perform t.admin();
  update public.support_access_grants set expires_at = now() - interval '1 minute' where id = v_id;
  perform t.as_user(t.id('op'), 'aal2');
  perform t.raises(format('select public.platform_support_snapshot(%L)', t.id('tenantA')), 'E_NO_CONSENT', '[PLT-010] access ends on its own when the time is up');
  perform t.login('adminA');
  perform t.eq((select status from public.list_support_access() where id = v_id), 'expired', '[PLT-010] and the hotel sees it as expired');
  perform t.admin();
end $$;

-- The new permission reaches the built-in administrator roles only.
do $$
begin
  perform t.admin();
  perform t.ok(exists (select 1 from public.role_permissions rp join public.roles r on r.id = rp.role_id where rp.permission_key = 'adm.support.manage' and r.code = 'SYSADMIN' and r.tenant_id is null),
    '[PLT-010] System Administrator can decide support access');
  perform t.ok(not exists (select 1 from public.role_permissions rp join public.roles r on r.id = rp.role_id where rp.permission_key = 'adm.support.manage' and r.code in ('FDO', 'HKS', 'MNT')),
    '[PLT-010] front desk, housekeeping and maintenance roles cannot');
end $$;

rollback;

-- Remove demo hotels (PLT-025). scripts/remove-hotels.sql deletes everything a hotel owns, including its ledger,
-- and its staff sign-ins. It never touches other hotels or platform operators, and a dry run changes nothing.
begin;

\i scripts/remove-hotels.sql

-- Give hotel A a ledger (a booking, a check-in and a payment) and a platform operator to protect.
do $$
declare v_r uuid; v_f uuid; v_op uuid := gen_random_uuid();
begin
  perform t.login('adminA');
  perform public.save_room(t.id('propA'), null, '170', t.id('std'), '1', true);
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('170'), null, null);
  v_f := t.main_folio(v_r);
  perform public.post_payment(v_f, t.pm('CASH'), 10000, 'NGN', false, null, null, 'rm-p1');
  perform t.admin();
  insert into auth.users (id, email, email_confirmed_at, aud, role) values (v_op, 'rm-op@platform.test', now(), 'authenticated', 'authenticated');
  perform t.put('rmop', v_op);
  perform app.add_platform_operator('rm-op@platform.test');
end $$;

-- Checks before anything is deleted.
do $$
begin
  perform t.admin();
  perform t.ok((select count(*) from public.folio_transactions where tenant_id = t.id('tenantA')) > 0, '[PLT-025] set-up: hotel A has ledger rows');
  perform t.raises('select pg_temp.remove_hotels(null, true)', 'E_INVALID', '[PLT-025] no hotel named: refused');
  perform t.raises(format('select pg_temp.remove_hotels(array[%L]::uuid[], false)', gen_random_uuid()), 'E_NOT_FOUND', '[PLT-025] an unknown hotel id: refused');
end $$;

-- A dry run does the whole job, reports, and leaves everything in place.
do $$
declare v_led int; v_audit int; v_users int;
begin
  perform t.admin();
  select count(*) into v_led from public.folio_transactions where tenant_id = t.id('tenantA');
  select count(*) into v_audit from public.audit_events where tenant_id = t.id('tenantA');
  select count(*) into v_users from auth.users where id in (select id from public.profiles where tenant_id = t.id('tenantA'));
  perform t.raises(format('select pg_temp.remove_hotels(array[%L]::uuid[], true)', t.id('tenantA')), 'E_DRY_RUN', '[PLT-025] a dry run stops with E_DRY_RUN');
  perform t.eq((select count(*)::int from public.tenants where id = t.id('tenantA')), 1, '[PLT-025] the dry run left the hotel');
  perform t.eq((select count(*)::int from public.folio_transactions where tenant_id = t.id('tenantA')), v_led, '[PLT-025] and its ledger');
  perform t.eq((select count(*)::int from public.audit_events where tenant_id = t.id('tenantA')), v_audit, '[PLT-025] and its audit log');
  perform t.eq((select count(*)::int from auth.users where id in (select id from public.profiles where tenant_id = t.id('tenantA'))), v_users, '[PLT-025] and its staff sign-ins');
  -- The same without replica mode (for a database role that may not set it): table triggers go off and come back on.
  perform t.raises(format('select pg_temp.remove_hotels(array[%L]::uuid[], true, true)', t.id('tenantA')), 'E_DRY_RUN', '[PLT-025] a dry run without replica mode also works');
  perform t.eq((select count(*)::int from public.folio_transactions where tenant_id = t.id('tenantA')), v_led, '[PLT-025] and leaves the ledger');
  perform t.eq((select count(*)::int from pg_trigger where tgname = 'folio_transactions_immutable' and tgenabled <> 'O'), 0, '[PLT-025] with the ledger lock still on');
end $$;

-- The real run removes hotel A and only hotel A.
do $$
declare v_b_rooms int; v_b_staff int; v_out text;
begin
  perform t.admin();
  select count(*) into v_b_rooms from public.rooms where tenant_id = t.id('tenantB');
  select count(*) into v_b_staff from public.profiles where tenant_id = t.id('tenantB');
  v_out := pg_temp.remove_hotels(array[t.id('tenantA')], false);
  perform t.ok(v_out like 'Removed 1 hotel(s)%', '[PLT-025] the run reports what it removed');
  perform t.eq((select count(*)::int from public.tenants where id = t.id('tenantA')), 0, '[PLT-025] the hotel is gone');
  perform t.eq((select count(*)::int from public.folio_transactions where tenant_id = t.id('tenantA')), 0, '[PLT-025] with its ledger');
  perform t.eq((select count(*)::int from public.audit_events where tenant_id = t.id('tenantA')), 0, '[PLT-025] and its audit log');
  perform t.eq((select count(*)::int from public.properties where tenant_id = t.id('tenantA')), 0, '[PLT-025] and its properties');
  perform t.eq((select count(*)::int from public.profiles where tenant_id = t.id('tenantA')), 0, '[PLT-025] and its staff records');
  perform t.eq((select count(*)::int from auth.users where email in ('adminA@test.local', 'fdo@test.local')), 0, '[PLT-025] and its staff sign-ins');
  perform t.eq((select count(*)::int from public.tenants where id = t.id('tenantB')), 1, '[PLT-025] hotel B is untouched');
  perform t.eq((select count(*)::int from public.rooms where tenant_id = t.id('tenantB')), v_b_rooms, '[PLT-025] with its rooms');
  perform t.eq((select count(*)::int from public.profiles where tenant_id = t.id('tenantB')), v_b_staff, '[PLT-025] and its staff');
  perform t.eq((select count(*)::int from auth.users where email = 'adminB@test.local'), 1, '[PLT-025] and its sign-in');
  perform t.eq((select count(*)::int from app.platform_operators where user_id = t.id('rmop')), 1, '[PLT-025] the platform operator stays');
  perform t.eq((select count(*)::int from auth.users where id = t.id('rmop')), 1, '[PLT-025] with the operator sign-in');
  perform t.ok((select count(*) from public.plans) > 0 and (select count(*) from public.permissions) > 0, '[PLT-025] the plan and permission lists stay');
  perform t.eq(current_setting('session_replication_role'), 'origin', '[PLT-025] the ledger locks are back on');
end $$;

-- Without replica mode, a real run removes hotel B and puts every lock back.
do $$
begin
  perform t.admin();
  perform pg_temp.remove_hotels(array[t.id('tenantB')], false, true);
  perform t.eq((select count(*)::int from public.tenants where id = t.id('tenantB')), 0, '[PLT-025] without replica mode: the hotel is gone');
  perform t.eq((select count(*)::int from public.properties where tenant_id = t.id('tenantB')), 0, '[PLT-025] with its properties');
  perform t.eq((select count(*)::int from auth.users where email = 'adminB@test.local'), 0, '[PLT-025] and its sign-in');
  perform t.eq((select count(*)::int from pg_trigger where tgname in ('folio_transactions_immutable', 'audit_events_immutable') and tgenabled <> 'O'), 0, '[PLT-025] and the ledger and audit locks are back on');
  perform t.eq((select count(*)::int from app.platform_operators where user_id = t.id('rmop')), 1, '[PLT-025] the platform operator still stays');
end $$;

-- Removing an operator: refused for unknown or non-operator accounts; dry run changes nothing.
do $$
begin
  perform t.admin();
  perform t.raises('select pg_temp.remove_operator(''nobody-here@platform.test'')', 'E_NOT_FOUND', '[PLT-025] an unknown email: refused');
  perform t.raises('select pg_temp.remove_operator(''adminB@test.local'')', 'E_NOT_FOUND', '[PLT-025] an account that is not an operator: refused');
  perform t.raises('select pg_temp.remove_operator(''rm-op@platform.test'', true)', 'E_DRY_RUN', '[PLT-025] an operator dry run stops with E_DRY_RUN');
  perform t.eq((select count(*)::int from app.platform_operators where user_id = t.id('rmop')), 1, '[PLT-025] and leaves the operator');
  perform t.ok(pg_temp.remove_operator('RM-op@platform.test', false) like 'Removed operator%', '[PLT-025] the real run removes the operator');
  perform t.eq((select count(*)::int from app.platform_operators where user_id = t.id('rmop')), 0, '[PLT-025] the operator record is gone');
  perform t.eq((select count(*)::int from auth.users where id = t.id('rmop')), 0, '[PLT-025] with the operator sign-in');
end $$;

rollback;

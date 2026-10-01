-- Shared fixtures, committed to the LOCAL test database once per run.
-- Hotel A (Sunrise Lodge) with one user per role, rooms, rates and guests. Hotel B (Coastal Inn) with its admin only.
-- Everything is created through the app's own functions, as the users would.
\set ON_ERROR_STOP 1
do $$
declare n text; v_uid uuid; r record;
begin
  foreach n in array array['adminA','adminB','gm','fdo','fom','acc','hks','att','mnt','rsv','csh','nobody','unconfirmed'] loop
    v_uid := gen_random_uuid();
    insert into auth.users (id, email, email_confirmed_at, aud, role)
    values (v_uid, n || '@test.local', case when n = 'unconfirmed' then null else now() end, 'authenticated', 'authenticated');
    perform t.put(n, v_uid);
  end loop;

  perform t.login('adminA');
  select * into r from public.create_hotel('Sunrise Lodge Ltd', 'NG', 'Sunrise Lodge', 'Ada Obi', 'Lagos');
  perform t.admin(); perform t.put('tenantA', r.tenant_id); perform t.put('propA', r.property_id);

  perform t.login('adminB');
  select * into r from public.create_hotel('Coastal Inn Ltd', 'NG', 'Coastal Inn', 'Bayo Ade', 'Port Harcourt');
  perform t.admin(); perform t.put('tenantB', r.tenant_id); perform t.put('propB', r.property_id);
  -- Hotel A on the Standard plan (25 users) so the tests can add staff.
  update public.tenant_subscriptions set plan_code = 'standard' where tenant_id = t.id('tenantA');
end $$;

-- Staff for hotel A. FDO and FOM get copied roles with limits (built-in roles can carry limits too since 6c; see 20_builtin_limits.sql).
do $$
declare n text; v_role uuid; v_fdol uuid; v_foml uuid;
begin
  perform t.login('adminA');
  v_fdol := public.copy_role((select id from public.roles where tenant_id is null and code = 'FDO'), 'FDOL', 'Front Desk (limits)');
  v_foml := public.copy_role((select id from public.roles where tenant_id is null and code = 'FOM'), 'FOML', 'Front Office Manager (limits)');
  perform public.set_approval_limit(v_fdol, 'fin.discount.apply', 5000);
  perform public.set_approval_limit(v_foml, 'fin.discount.approve', 20000);
  perform public.set_approval_limit(v_foml, 'fin.adjust.approve', 20000);
  perform public.set_approval_limit(v_foml, 'fin.discount.apply', 20000);
  perform public.set_approval_limit(v_foml, 'fin.reverse.post', 20000);
  foreach n in array array['gm','fdo','fom','acc','hks','att','mnt','rsv','csh'] loop
    perform public.register_invited_user(t.id(n), initcap(n) || ' Staff', null);
    v_role := case n when 'fdo' then v_fdol when 'fom' then v_foml else
      (select id from public.roles where tenant_id is null and code = case n
        when 'gm' then 'GM' when 'acc' then 'ACCT' when 'hks' then 'HKS' when 'att' then 'RA'
        when 'mnt' then 'MNT' when 'rsv' then 'RES' when 'csh' then 'CASHIER' end) end;
    perform public.assign_role(t.id(n), t.id('propA'), v_role);
  end loop;
  perform t.admin();
  perform t.put('role_fdol', v_fdol); perform t.put('role_foml', v_foml);
end $$;

-- Configuration for hotel A.
do $$
declare p uuid := t.id('propA'); bd date; v_std uuid; v_dlx uuid; v_bar uuid; v_pre uuid; n text;
begin
  perform t.login('adminA');
  select business_date into bd from public.properties where id = p;
  v_std := public.save_room_type(p, null, 'STD', 'Standard', 2, 1, null, true);
  v_dlx := public.save_room_type(p, null, 'DLX', 'Deluxe', 3, 2, null, true);
  foreach n in array array['101','102','103'] loop perform public.save_room(p, null, n, v_std, '1', true); end loop;
  perform public.save_room(p, null, '201', v_dlx, '2', true);
  v_bar := public.save_rate_plan(p, null, 'BAR', 'Best available', false, 'nights', 1, 'nights', 1, 'none', 0, true);
  v_pre := public.save_rate_plan(p, null, 'PREPAID', 'Deposit rate', false, 'none', 0, 'none', 0, 'percent', 50, true);
  perform public.save_rate_plan_price(null, v_bar, v_std, bd - 30, bd + 400, 50000, 'NGN');
  perform public.save_rate_plan_price(null, v_bar, v_dlx, bd - 30, bd + 400, 90000, 'NGN');
  perform public.save_rate_plan_price(null, v_pre, v_std, bd - 30, bd + 400, 50000, 'NGN');
  perform public.save_rate_plan_price(null, v_pre, v_dlx, bd - 30, bd + 400, 90000, 'NGN');
  perform public.set_exchange_rate(p, 'USD', bd - 5, 1500);
  perform t.admin();
  perform t.put('std', v_std); perform t.put('dlx', v_dlx); perform t.put('bar', v_bar); perform t.put('prepaid', v_pre);
  -- Free cancellation up to 2 days before arrival, once the app supports the setting.
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'rate_plans'
             and column_name = 'cancellation_free_days') then
    execute format('update public.rate_plans set cancellation_free_days = 2 where id = %L', v_bar);
  end if;
end $$;

-- Guests, created by front desk.
do $$ begin
  perform t.login('fdo');
  perform t.put('g1', public.save_guest(null, 'Chinedu', 'Okafor', '08030000001', 'chinedu@example.ng', 'NG', null, null));
  perform t.put('g2', public.save_guest(null, 'Amina', 'Bello', '08030000002', null, 'NG', null, null));
  perform t.put('g3', public.save_guest(null, 'Tunde', 'Balogun', '08030000003', null, 'NG', null, null));
  perform t.admin();
end $$;
select 'fixtures ready' as status;

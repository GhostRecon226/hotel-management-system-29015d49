-- Upgrade test, part 2. Runs after the new migrations were applied on top of before.sql.
-- Proves a hotel that existed before them gets the new rules (what will happen on the live project).
-- Prints "ok - ..." or "not ok - ..." like the main suite. Rolls back.
begin;
create function pg_temp.id(n text) returns uuid language sql as $$ select id from upg.ids where name = n $$;
create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin if c is true then raise notice 'ok - %', msg; else raise notice 'not ok - %', msg; end if; end $$;
create function pg_temp.as_user(n text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('app.settlement', '', false);
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(n), 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;
grant usage on schema upg to authenticated; grant select on upg.ids to authenticated;

do $$
declare v_level text; v_n int;
begin
  -- Move-charges permission (fix 3)
  perform pg_temp.ok((select count(*) = 4 from public.role_permissions rp join public.roles r on r.id = rp.role_id
    where r.tenant_id is null and rp.permission_key = 'fin.folio.transfer' and r.code in ('SYSADMIN', 'GM', 'FOM', 'ACCT')),
    '[upgrade] built-in System Administrator, General Manager, Front Office Manager and Accountant roles hold fin.folio.transfer');
  perform pg_temp.ok(not exists (select 1 from public.role_permissions rp join public.roles r on r.id = rp.role_id
    where r.tenant_id is null and rp.permission_key = 'fin.folio.transfer' and r.code in ('FDO', 'RES', 'CASHIER', 'HKS', 'RA', 'MNT')),
    '[upgrade] front desk, reservations, cashier and housekeeping roles do not');
  perform pg_temp.ok(not exists (select 1 from public.role_permissions where role_id = pg_temp.id('copy') and permission_key = 'fin.folio.transfer'),
    '[upgrade] a custom role copied before the upgrade is left as the hotel made it (the administrator adds the permission if wanted)');

  perform pg_temp.as_user('admin');
  perform pg_temp.ok(app.can('fin.folio.transfer', pg_temp.id('prop')), '[upgrade] the existing hotel''s administrator can move charges');

  -- Own-records folio access for reservation officers (fix 4)
  execute 'reset role';
  select rp.grant_level into v_level from public.role_permissions rp join public.roles r on r.id = rp.role_id
  where r.tenant_id is null and r.code = 'RES' and rp.permission_key = 'fin.folio.view';
  perform pg_temp.ok(v_level = 'O', '[upgrade] the built-in Reservation Officer role has own-records folio access (level O)');
  perform pg_temp.as_user('rsv');
  perform pg_temp.ok(app.my_level('fin.folio.view', pg_temp.id('prop')) = 'O', '[upgrade] the existing reservation officer now has level O');
  select count(*) into v_n from public.folios;
  perform pg_temp.ok(v_n = 1, '[upgrade] and sees only the folio of the booking they made before the upgrade');
  perform pg_temp.ok(exists (select 1 from public.folios where reservation_id = pg_temp.id('resB')), '[upgrade] which is their own booking');

  -- Deposits only for reservation officers (decision 6a)
  execute 'reset role';
  perform pg_temp.ok(exists (select 1 from public.role_permissions rp join public.roles r on r.id = rp.role_id
    where r.tenant_id is null and r.code = 'RES' and rp.permission_key = 'fin.deposit.take'),
    '[upgrade][6a] the built-in Reservation Officer role can take deposits');
  perform pg_temp.ok(not exists (select 1 from public.role_permissions rp join public.roles r on r.id = rp.role_id
    where r.tenant_id is null and r.code = 'RES' and rp.permission_key = 'fin.payment.post'),
    '[upgrade][6a] and no longer takes other payments');

  -- Every permission is held by the administrator roles, so every built-in role can still be handed out.
  perform pg_temp.ok(not exists (select 1 from public.permissions p where not exists (
      select 1 from public.role_permissions rp join public.roles r on r.id = rp.role_id
      where r.tenant_id is null and r.code = 'SYSADMIN' and rp.permission_key = p.key)),
    '[upgrade] the System Administrator role holds every permission, including the new ones');
  perform pg_temp.ok(not exists (select 1 from public.permissions p where not exists (
      select 1 from public.role_permissions rp join public.roles r on r.id = rp.role_id
      where r.tenant_id is null and r.code = 'GM' and rp.permission_key = p.key)),
    '[upgrade] the General Manager role holds every permission, including the new ones');
  execute 'reset role';
  insert into auth.users (id, email, email_confirmed_at, aud, role) values ('00000000-0000-0000-0000-00000000ab01', 'upg-new@test.local', now(), 'authenticated', 'authenticated');
  insert into upg.ids values ('newstaff', '00000000-0000-0000-0000-00000000ab01');
  perform pg_temp.as_user('admin');
  perform public.register_invited_user(pg_temp.id('newstaff'), 'New Starter', null);
  begin
    perform public.assign_role(pg_temp.id('newstaff'), pg_temp.id('prop'), (select id from public.roles where tenant_id is null and code = 'RES'));
    perform pg_temp.ok(true, '[upgrade] the existing administrator can still give someone the Reservation Officer role');
  exception when others then perform pg_temp.ok(false, '[upgrade] the existing administrator can still give someone the Reservation Officer role (' || sqlerrm || ')');
  end;
  begin
    perform public.assign_role(pg_temp.id('newstaff'), pg_temp.id('prop'), (select id from public.roles where tenant_id is null and code = 'FOM'));
    perform pg_temp.ok(true, '[upgrade] and the Front Office Manager role');
  exception when others then perform pg_temp.ok(false, '[upgrade] and the Front Office Manager role (' || sqlerrm || ')');
  end;

  -- Other new data on the existing property
  perform pg_temp.ok(exists (select 1 from public.document_sequences where property_id = pg_temp.id('prop') and doc_type = 'interim'),
    '[upgrade] the existing property got the interim invoice number series');
  execute 'reset role';
exception when others then execute 'reset role'; raise notice 'not ok - [upgrade crashed] %', sqlerrm;
end $$;
rollback;

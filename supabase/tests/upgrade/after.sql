-- Upgrade test, part 2. Runs after the new migrations were applied on top of before.sql.
-- Proves a hotel that existed before them gets the new rules (what will happen on the live project).
-- Prints "ok - ..." or "not ok - ..." like the main suite. Rolls back.
-- Baseline: the live project has every migration up to 20260930160100 (applied 1 Oct 2026).
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

-- Ledger and audit trail locked (20261001100000)
do $$
declare v_n int;
begin
  begin
    delete from public.audit_events where tenant_id = pg_temp.id('tenant');
    perform pg_temp.ok(false, '[upgrade][ADM-006] the existing hotel''s audit rows cannot be deleted by the owner');
  exception when others then perform pg_temp.ok(sqlerrm like '%E_IMMUTABLE%', '[upgrade][ADM-006] the existing hotel''s audit rows cannot be deleted by the owner');
  end;
  perform pg_temp.as_user('admin');
  perform public.post_payment(public.open_main_folio(pg_temp.id('resA')),
    (select id from public.payment_methods where property_id = pg_temp.id('prop') and code = 'CASH'), 10000, 'NGN', true, 'Deposit', null, 'upg-dep');
  select count(*) into v_n from public.folio_transactions where folio_id = public.open_main_folio(pg_temp.id('resA'));
  perform pg_temp.ok(v_n = 1, '[upgrade][FIN-014] the existing hotel can still take a deposit on the open business date');
  execute 'reset role';
exception when others then execute 'reset role'; raise notice 'not ok - [upgrade crashed] %', sqlerrm;
end $$;
rollback;

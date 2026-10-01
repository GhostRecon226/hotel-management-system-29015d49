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
-- Guests with a booking that is not over cannot be anonymised (20261001100100)
do $$
declare v_g uuid;
begin
  select guest_id into v_g from public.reservations where id = pg_temp.id('resA');
  perform pg_temp.as_user('admin');
  begin
    perform public.anonymise_guest(v_g, 'Request');
    perform pg_temp.ok(false, '[upgrade][GST-005] a guest booked before the upgrade cannot be anonymised while the booking is open');
  exception when others then perform pg_temp.ok(sqlerrm like '%E_IN_USE%', '[upgrade][GST-005] a guest booked before the upgrade cannot be anonymised while the booking is open');
  end;
  execute 'reset role';
exception when others then execute 'reset role'; raise notice 'not ok - [upgrade crashed] %', sqlerrm;
end $$;
-- Same-day stays (20261001100400)
do $$
declare v_r uuid; v_bd date;
begin
  select business_date into v_bd from public.properties where id = pg_temp.id('prop');
  perform pg_temp.as_user('admin');
  v_r := public.create_reservation(pg_temp.id('prop'), 'upg-sameday', (select guest_id from public.reservations where id = pg_temp.id('resA')),
    v_bd + 9, v_bd + 9, (select room_type_id from public.reservations where id = pg_temp.id('resA')), pg_temp.id('bar'),
    1, 0, 'confirmed', 'direct', null, null, null, 'none', null, null, null, null);
  perform pg_temp.ok((select total_amount = 40000 from public.reservations where id = v_r), '[upgrade][DAY-006] the existing hotel can book a same-day stay, priced at one night');
  perform pg_temp.ok((select total_amount = 40000 from public.reservations where id = pg_temp.id('resA')), '[upgrade][DAY-006] bookings made before the upgrade keep their totals');
  execute 'reset role';
exception when others then execute 'reset role'; raise notice 'not ok - [upgrade crashed] %', sqlerrm;
end $$;
rollback;

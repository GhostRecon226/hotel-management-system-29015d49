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
create function upg_tmp_put(n text, v uuid) returns void language sql security definer set search_path = public as $$ insert into upg.ids values (n, v) $$;
grant execute on function upg_tmp_put(text, uuid) to authenticated;

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
-- Approval limits on built-in roles (20261001100500)
do $$
declare v_fdo uuid := (select id from public.roles where tenant_id is null and code = 'FDO');
begin
  perform pg_temp.as_user('admin');
  perform public.set_approval_limit(v_fdo, 'fin.discount.apply', 2500);
  perform pg_temp.ok((select max_amount = 2500 and tenant_id = pg_temp.id('tenant') from public.approval_limits where role_id = v_fdo),
    '[upgrade][6c] the existing hotel can set a limit on the built-in Front Desk role, kept for that hotel only');
  execute 'reset role';
exception when others then execute 'reset role'; raise notice 'not ok - [upgrade crashed] %', sqlerrm;
end $$;
-- Money flows and a multi-day catch-up roll still work under the ledger lock (20261001100000).
-- A front desk clerk requests a refund, an adjustment and a discount; a front office manager requests a
-- reversal; the administrator asks for a reversal too; a general manager approves them all. Then the hotel
-- is three business dates behind and one roll call catches up all three, including an overstaying guest.
do $$
declare v_today date; v_bd0 date; v_std uuid; v_bar uuid; v_g uuid; v_a uuid; v_b uuid; v_fa uuid; v_fb uuid;
  v_c1 uuid; v_c2 uuid; v_c3 uuid; j jsonb; v_res jsonb; v_n int; v_bad int; v_cash uuid; v_rest uuid; r record;
  v_fd uuid := '00000000-0000-0000-0000-00000000ab11'; v_fom uuid := '00000000-0000-0000-0000-00000000ab12'; v_gm uuid := '00000000-0000-0000-0000-00000000ab13';
begin
  -- set-up as the owner: three staff, and the business date three days behind with roll time midnight
  insert into auth.users (id, email, email_confirmed_at, aud, role) values
    (v_fd, 'upg-fd@test.local', now(), 'authenticated', 'authenticated'),
    (v_fom, 'upg-fom@test.local', now(), 'authenticated', 'authenticated'),
    (v_gm, 'upg-gm@test.local', now(), 'authenticated', 'authenticated');
  insert into upg.ids values ('fd', v_fd), ('fom', v_fom), ('gm', v_gm);
  update public.tenant_subscriptions set plan_code = 'standard' where tenant_id = pg_temp.id('tenant');
  select business_date into v_today from public.properties where id = pg_temp.id('prop');
  v_bd0 := v_today - 3;
  perform set_config('app.rolling', 'on', true);
  update public.properties set business_date = v_bd0, rollover_time = '00:00' where id = pg_temp.id('prop');
  perform set_config('app.rolling', '', true);
  select id into v_cash from public.payment_methods where property_id = pg_temp.id('prop') and code = 'CASH';
  select id into v_rest from public.charge_codes where property_id = pg_temp.id('prop') and code = 'REST';
  select room_type_id into v_std from public.reservations where id = pg_temp.id('resA');
  v_bar := pg_temp.id('bar');
  select guest_id into v_g from public.reservations where id = pg_temp.id('resA');

  perform pg_temp.as_user('admin');
  perform public.register_invited_user(v_fd, 'Fola Desk', null);
  perform public.register_invited_user(v_fom, 'Femi Manager', null);
  perform public.register_invited_user(v_gm, 'Grace GM', null);
  perform public.assign_role(v_fd, pg_temp.id('prop'), (select id from public.roles where tenant_id is null and code = 'FDO'));
  perform public.assign_role(v_fom, pg_temp.id('prop'), (select id from public.roles where tenant_id is null and code = 'FOM'));
  perform public.assign_role(v_gm, pg_temp.id('prop'), (select id from public.roles where tenant_id is null and code = 'GM'));

  -- two guests in house: A due out after 2 nights (will overstay during the catch-up), B for 5 nights
  perform pg_temp.as_user('fd');
  v_a := public.create_reservation(pg_temp.id('prop'), 'upg-ov', v_g, v_bd0, v_bd0 + 2, v_std, v_bar, 1, 0, 'confirmed', 'direct', null, null, null, 'none', null, null, null, null);
  v_b := public.create_reservation(pg_temp.id('prop'), 'upg-long', v_g, v_bd0, v_bd0 + 5, v_std, v_bar, 1, 0, 'confirmed', 'direct', null, null, null, 'none', null, null, null, null);
  perform public.check_in(v_a, '{"id_type":"passport","id_number":"U1","nationality":"NG"}'::jsonb,
    (select id from public.rooms where property_id = pg_temp.id('prop') and room_number = '1'), null, null);
  perform public.check_in(v_b, '{"id_type":"passport","id_number":"U2","nationality":"NG"}'::jsonb,
    (select id from public.rooms where property_id = pg_temp.id('prop') and room_number = '2'), null, null);
  v_fa := public.open_main_folio(v_a); v_fb := public.open_main_folio(v_b);
  v_c1 := public.post_charge(v_fa, v_rest, 10000, false, 'Dinner', null, 'upg-c1');
  v_c2 := public.post_charge(v_fa, v_rest, 4000, false, 'Lunch', null, 'upg-c2');
  v_c3 := public.post_charge(v_fb, v_rest, 2000, false, 'Snack', null, 'upg-c3');
  perform public.post_payment(v_fa, v_cash, 20000, 'NGN', false, null, null, 'upg-p1');
  perform pg_temp.ok((select business_date = v_bd0 from public.folio_transactions where id = v_c1), '[upgrade][ledger lock] a charge posts on the open business date');

  -- requests by front desk (limit zero, so each waits for approval) and by the front office manager
  j := public.request_refund(v_fa, v_cash, 3000, 'NGN', null, 'Overpaid', 'upg-ref');
  perform pg_temp.ok(j->>'status' = 'pending', '[upgrade][ledger lock] front desk refund request waits for approval');
  if j->>'approval_id' is not null then perform upg_tmp_put('ap_ref', (j->>'approval_id')::uuid); end if;
  j := public.request_adjustment(v_fa, v_rest, -1000, 'Overcharged', 'upg-adj');
  perform pg_temp.ok(j->>'status' = 'pending', '[upgrade][ledger lock] front desk adjustment waits for approval (' || j::text || ')');
  if j->>'approval_id' is not null then perform upg_tmp_put('ap_adj', (j->>'approval_id')::uuid); end if;
  j := public.apply_discount(v_c2, 500, 'Cold food', 'upg-disc');
  perform pg_temp.ok(j->>'status' = 'posted', '[upgrade][ledger lock][6c] a 500 discount posts straight away: front desk has this hotel''s 2,500 limit');
  perform pg_temp.as_user('fom');
  j := public.request_reversal(v_c3, 'Wrong folio', 'upg-rev');
  perform pg_temp.ok(j->>'status' = 'pending', '[upgrade][ledger lock] manager reversal waits for approval (' || j::text || ')');
  if j->>'approval_id' is not null then perform upg_tmp_put('ap_rev', (j->>'approval_id')::uuid); end if;

  perform pg_temp.as_user('gm');
  for r in select name, id from upg.ids where name in ('ap_ref', 'ap_adj', 'ap_rev') order by name loop
    begin
      perform public.decide_approval(r.id, true, 'Checked');
      perform pg_temp.ok((select status = 'approved' and posted_transaction_id is not null from public.approvals where id = r.id),
        '[upgrade][ledger lock] approved and posted: ' || case r.name when 'ap_ref' then 'refund' when 'ap_adj' then 'adjustment'
          when 'ap_disc' then 'discount' else 'reversal' end);
    exception when others then perform pg_temp.ok(false, '[upgrade][ledger lock] approval ' || r.name || ' failed: ' || sqlerrm);
    end;
  end loop;
  perform pg_temp.as_user('admin');
  j := public.request_reversal(v_c1, 'Not ordered', 'upg-rev2');
  perform pg_temp.ok(j->>'status' = 'pending', '[upgrade][D1] even the administrator''s reversal waits for a second person');
  perform pg_temp.as_user('gm');
  perform public.decide_approval((j->>'approval_id')::uuid, true, 'Agreed');
  perform pg_temp.ok((select status = 'approved' and posted_transaction_id is not null from public.approvals where id = (j->>'approval_id')::uuid),
    '[upgrade][ledger lock] approved and posted: the administrator''s reversal');
  execute 'reset role';
  -- 11,825 - 11,825 (reversed) + 4,730 - 500 (discount, tax included) - 1,000 (adjustment) - 20,000 + 3,000 (refund)
  perform pg_temp.ok(app.folio_balance(v_fa) = 4730 - 500 - 1000 - 20000 + 3000,
    '[upgrade][ledger lock] the folio balance adds up after refund, adjustment, discount and reversal (' || app.folio_balance(v_fa) || ')');
  select count(*) into v_bad from public.folio_transactions where folio_id in (v_fa, v_fb) and business_date <> v_bd0;
  perform pg_temp.ok(v_bad = 0, '[upgrade][ledger lock] every row so far carries the open business date');

  -- one roll call catches up three business dates
  v_res := app.run_due_rollovers(pg_temp.id('tenant'), 'schedule', null);
  perform pg_temp.ok(jsonb_array_length(v_res) = 3 and not exists (select 1 from jsonb_array_elements(v_res) x where x->>'status' <> 'success'),
    '[upgrade][DAY-001] one roll call catches up three business dates, all successful (' || v_res::text || ')');
  perform pg_temp.ok((select business_date = v_today from public.properties where id = pg_temp.id('prop')), '[upgrade][DAY-001] the business date is back to today');
  select count(*) into v_n from public.business_date_log where property_id = pg_temp.id('prop') and status = 'success' and from_date >= v_bd0;
  perform pg_temp.ok(v_n = 3, '[upgrade][DAY-001] three successful rolls in the history');
  select count(*) into v_n from public.folio_transactions t where t.folio_id = v_fb and t.idempotency_key like 'room:%';
  perform pg_temp.ok(v_n = 3, '[upgrade][DAY-001] the long-stay guest is charged each of the three nights (' || v_n || ')');
  perform pg_temp.ok((select array_agg(business_date order by business_date) = array[v_bd0, v_bd0 + 1, v_bd0 + 2]
    from public.folio_transactions where folio_id = v_fb and idempotency_key like 'room:%'), '[upgrade][DAY-001][FIN-014] each night is dated its own business date');
  select count(*) into v_n from public.folio_transactions t where t.folio_id = v_fa and t.idempotency_key like 'room:%';
  perform pg_temp.ok(v_n = 3, '[upgrade][DAY-003] the overstaying guest is charged two booked nights and the overstay night (' || v_n || ')');
  perform pg_temp.ok((select departure_date = v_today from public.reservations where id = v_a), '[upgrade][DAY-003] and the stay was extended to today');

  -- after the catch-up the desk posts on the new date, and the ledger is still locked
  perform pg_temp.as_user('fd');
  v_c1 := public.post_charge(v_fb, v_rest, 1500, false, 'Water', null, 'upg-c4');
  perform pg_temp.ok((select business_date = v_today from public.folio_transactions where id = v_c1), '[upgrade][ledger lock] the next charge carries the new business date');
  execute 'reset role';
  begin
    delete from public.folio_transactions where folio_id = v_fa;
    perform pg_temp.ok(false, '[upgrade][ledger lock] the ledger still cannot be deleted after all this');
  exception when others then perform pg_temp.ok(sqlerrm like '%E_IMMUTABLE%', '[upgrade][ledger lock] the ledger still cannot be deleted after all this');
  end;
exception when others then execute 'reset role'; raise notice 'not ok - [upgrade crashed: money flows and roll] %', sqlerrm;
end $$;
rollback;

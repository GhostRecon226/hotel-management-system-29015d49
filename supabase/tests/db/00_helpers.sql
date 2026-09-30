-- Test helpers. Loaded by scripts/test-db.sh into the LOCAL Supabase database only.
-- Never run this against a real project.
-- Every check prints "ok - ..." or "not ok - ..." and carries on, so one run shows every failure.
drop schema if exists t cascade;
create schema t;
create table t.ids (name text primary key, id uuid not null);

create function t.id(n text) returns uuid language sql stable as $$ select id from t.ids where name = n $$;
create function t.put(n text, v uuid) returns void language sql security definer as $$
  insert into t.ids values (n, v) on conflict (name) do update set id = excluded.id $$;

-- Act as a named test user (the browser role). Each login is like a new request from the browser,
-- so request-scoped flags set by the previous call are cleared.
create function t.login(n text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('app.settlement', '', false);
  perform set_config('request.jwt.claim.sub', t.id(n)::text, false);
  perform set_config('request.jwt.claims', json_build_object('sub', t.id(n), 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;

-- Act as someone who is not signed in.
create function t.anon() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '{"role":"anon"}', false);
  execute 'set role anon';
end $$;

-- Back to the database owner (for set-up only).
create function t.admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '', false);
end $$;

create function t.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if c is true then raise notice 'ok - %', msg; else raise notice 'not ok - %', msg; end if;
end $$;

create function t.eq(a anyelement, b anyelement, msg text) returns void language plpgsql as $$
begin
  if a is not distinct from b then raise notice 'ok - %', msg;
  else raise notice 'not ok - % (got %, expected %)', msg, a, b; end if;
end $$;

-- Expect the statement to fail with an error containing p_frag.
-- p_frag may list alternatives separated by "|", for example 'E_FORBIDDEN|E_NOT_FOUND'.
-- If the statement wrongly succeeds, its effects are undone so later checks are not disturbed.
create function t.raises(p_sql text, p_frag text, msg text) returns void language plpgsql as $$
declare v_msg text;
begin
  begin
    execute p_sql;
    raise exception 'T_WRONGLY_SUCCEEDED';
  exception when others then v_msg := sqlerrm;
  end;
  if v_msg = 'T_WRONGLY_SUCCEEDED' then raise notice 'not ok - % (expected [%], but it succeeded)', msg, p_frag;
  elsif not exists (select 1 from unnest(string_to_array(p_frag, '|')) f where position(f in v_msg) > 0) then
    raise notice 'not ok - % (expected [%], got [%])', msg, p_frag, v_msg;
  else raise notice 'ok - %', msg; end if;
end $$;

-- Expect the statement to succeed.
create function t.lives(p_sql text, msg text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
    raise notice 'ok - %', msg;
  exception when others then raise notice 'not ok - % (failed: %)', msg, sqlerrm;
  end;
end $$;

-- Report a scenario block that crashed before its checks could run.
create function t.crash(p_block text, p_err text) returns void language plpgsql as $$
begin
  raise notice 'not ok - [% crashed] %', p_block, p_err;
end $$;

-- Shortcuts for hotel A.
create function t.bdate() returns date language sql stable security definer as $$
  select business_date from public.properties where id = t.id('propA') $$;
create function t.pm(p_code text) returns uuid language sql stable security definer as $$
  select id from public.payment_methods where property_id = t.id('propA') and code = p_code $$;
create function t.cc(p_code text) returns uuid language sql stable security definer as $$
  select id from public.charge_codes where property_id = t.id('propA') and code = p_code $$;
create function t.main_folio(p_res uuid) returns uuid language sql stable security definer as $$
  select id from public.folios where reservation_id = p_res and is_main $$;
create function t.balance(p_folio uuid) returns numeric language sql stable security definer as $$
  select balance from public.v_folio_balances where folio_id = p_folio $$;
create function t.room(p_number text) returns uuid language sql stable security definer as $$
  select id from public.rooms where property_id = t.id('propA') and room_number = p_number $$;

-- Book as the current user. Defaults: confirmed, direct, 1 adult, no guarantee.
create function t.book(p_guest uuid, p_arrival date, p_departure date, p_type uuid, p_plan uuid,
  p_key text default null, p_status text default 'confirmed', p_adults int default 1, p_guarantee text default 'none')
returns uuid language sql as $$
  select public.create_reservation(t.id('propA'), coalesce(p_key, gen_random_uuid()::text), p_guest, p_arrival, p_departure,
    p_type, p_plan, p_adults, 0, p_status, 'direct', null, null, null, p_guarantee, null, null, null, null) $$;

create function t.reg() returns jsonb language sql immutable as $$
  select '{"id_type":"passport","id_number":"A1234567","nationality":"NG"}'::jsonb $$;

-- Move a property's business date (test set-up only, bypasses the date lock).
create function t.set_bdate(p_prop uuid, p_date date) returns void language plpgsql security definer as $$
begin
  perform set_config('app.rolling', 'on', true);
  update public.properties set business_date = p_date where id = p_prop;
  perform set_config('app.rolling', '', true);
end $$;

-- Set a hotel's access status directly (test set-up only).
create function t.set_tenant_status(p_tenant uuid, p_status text) returns void language plpgsql security definer as $$
begin
  update public.tenants set status = p_status where id = p_tenant;
  update public.tenant_subscriptions set status = p_status where tenant_id = p_tenant;
end $$;

grant usage on schema t to authenticated, anon;
grant select on t.ids to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

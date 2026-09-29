-- Tenant isolation test.
-- Proves a user from hotel A cannot read hotel B's rows.
-- Runs inside a transaction and rolls back; leaves no data behind.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/tenant_isolation.sql

begin;

-- Two confirmed test users
insert into auth.users (id, email, email_confirmed_at, aud, role)
values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.local', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.local', now(), 'authenticated', 'authenticated');

set local role authenticated;

-- User A creates hotel A
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select * from public.create_hotel('Hotel A Ltd', 'NG', 'Hotel A Ikeja', 'Ada A', 'Lagos');

-- User B creates hotel B
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select * from public.create_hotel('Hotel B Ltd', 'NG', 'Hotel B Wuse', 'Bola B', 'Abuja');

-- Back to user A: must see only hotel A
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

do $$
declare v_a uuid := app.my_tenant(); n int;
begin
  if v_a is null then raise exception 'FAIL: user A has no tenant'; end if;

  select count(*) into n from public.tenants where id <> v_a;
  if n <> 0 then raise exception 'FAIL: tenants leak (%)', n; end if;
  select count(*) into n from public.tenant_subscriptions where tenant_id <> v_a;
  if n <> 0 then raise exception 'FAIL: tenant_subscriptions leak (%)', n; end if;
  select count(*) into n from public.profiles where tenant_id <> v_a;
  if n <> 0 then raise exception 'FAIL: profiles leak (%)', n; end if;
  select count(*) into n from public.properties where tenant_id <> v_a;
  if n <> 0 then raise exception 'FAIL: properties leak (%)', n; end if;
  select count(*) into n from public.user_property_roles where tenant_id <> v_a;
  if n <> 0 then raise exception 'FAIL: user_property_roles leak (%)', n; end if;
  select count(*) into n from public.roles where tenant_id is not null and tenant_id <> v_a;
  if n <> 0 then raise exception 'FAIL: roles leak (%)', n; end if;
  select count(*) into n from public.audit_events where tenant_id is distinct from v_a;
  if n <> 0 then raise exception 'FAIL: audit_events leak (%)', n; end if;

  -- Sanity: A does see its own data
  select count(*) into n from public.properties;
  if n <> 1 then raise exception 'FAIL: user A should see 1 property, saw %', n; end if;

  -- A cannot remove its only System Administrator
  begin
    delete from public.user_property_roles
    where role_id = (select id from public.roles where code = 'SYSADMIN' and tenant_id is null);
    raise exception 'FAIL: last System Administrator was removed';
  exception when others then
    if sqlerrm not like '[E_LAST_SYSADMIN]%' then raise; end if;
  end;

  -- A cannot create a second hotel
  begin
    perform public.create_hotel('X', 'NG', 'X', 'X', 'X');
    raise exception 'FAIL: second hotel was created';
  exception when others then
    if sqlerrm not like '[E_ALREADY_HAS_HOTEL]%' then raise; end if;
  end;

  raise notice 'PASS: tenant isolation holds';
end $$;

rollback;

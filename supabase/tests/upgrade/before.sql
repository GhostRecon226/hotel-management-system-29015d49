-- Upgrade test, part 1. Runs on a LOCAL database built only up to the migrations the live project
-- already has (UPGRADE_FROM in scripts/test-db.sh). Creates a hotel the way users would, before the
-- new migrations exist. Committed; part 2 (after.sql) checks it once the new migrations are applied.
\set ON_ERROR_STOP 1
create schema if not exists upg;
create table if not exists upg.ids (name text primary key, id uuid not null);

do $$
declare v_admin uuid := gen_random_uuid(); v_rsv uuid := gen_random_uuid(); r record; v_res_role uuid; v_copy uuid;
  v_std uuid; v_bar uuid; bd date; v_a uuid; v_b uuid; v_g uuid;
begin
  insert into auth.users (id, email, email_confirmed_at, aud, role) values
    (v_admin, 'upg-admin@test.local', now(), 'authenticated', 'authenticated'),
    (v_rsv, 'upg-rsv@test.local', now(), 'authenticated', 'authenticated');

  -- the administrator signs up and creates the hotel
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
  select * into r from public.create_hotel('Old Hotel Ltd', 'NG', 'Old Hotel', 'Olu Old', 'Lagos');
  v_res_role := (select id from public.roles where tenant_id is null and code = 'RES');
  v_copy := public.copy_role((select id from public.roles where tenant_id is null and code = 'FOM'), 'FOMX', 'Duty manager (custom)');
  perform public.register_invited_user(v_rsv, 'Rita Reservations', null);
  perform public.assign_role(v_rsv, r.property_id, v_res_role);
  v_std := public.save_room_type(r.property_id, null, 'STD', 'Standard', 2, 0, null, true);
  perform public.bulk_add_rooms(r.property_id, 1, 3, v_std, '1');
  v_bar := public.save_rate_plan(r.property_id, null, 'BAR', 'Best', false, 'nights', 1, 'nights', 1, 'none', 0, true);
  select business_date into bd from public.properties where id = r.property_id;
  perform public.save_rate_plan_price(null, v_bar, v_std, bd - 30, bd + 400, 40000, 'NGN');
  v_g := public.save_guest(null, 'Grace', 'Guest', '08030000009', null, 'NG', null, null);
  -- one booking by the administrator, one by the reservation officer, each with a folio
  v_a := public.create_reservation(r.property_id, 'upg-a', v_g, bd + 5, bd + 6, v_std, v_bar, 1, 0, 'confirmed', 'direct', null, null, null, 'none', null, null, null, null);
  perform public.open_main_folio(v_a);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_rsv, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
  v_b := public.create_reservation(r.property_id, 'upg-b', v_g, bd + 7, bd + 8, v_std, v_bar, 1, 0, 'confirmed', 'direct', null, null, null, 'none', null, null, null, null);
  perform public.open_main_folio(v_b);
  execute 'reset role';
  perform set_config('request.jwt.claims', '', false);

  insert into upg.ids values ('admin', v_admin), ('rsv', v_rsv), ('tenant', r.tenant_id), ('prop', r.property_id),
    ('copy', v_copy), ('resA', v_a), ('resB', v_b), ('bar', v_bar);
end $$;
-- PLT-004 (wave 1): a Ghana hotel created before the country defaults existed got naira and Lagos time.
do $$
declare v_gh uuid := gen_random_uuid(); r record;
begin
  insert into auth.users (id, email, email_confirmed_at, aud, role) values (v_gh, 'upg-gh@test.local', now(), 'authenticated', 'authenticated');
  perform set_config('request.jwt.claims', json_build_object('sub', v_gh, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
  select * into r from public.create_hotel('Old Accra Ltd', 'Ghana', 'Old Accra', 'Ama Old', 'Accra');
  execute 'reset role';
  perform set_config('request.jwt.claims', '', false);
  insert into upg.ids values ('propGH', r.property_id);
end $$;
select 'hotel created before the new migrations' as status;

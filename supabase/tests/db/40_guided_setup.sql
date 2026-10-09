-- Guided first setup (SET-011): one function tells a hotel what is left to set up, from the data it already has.
begin;

update public.tenant_subscriptions set plan_code = 'pro' where tenant_id = (select tenant_id from public.properties where id = t.id('propA'));

do $$
declare v_bd date; v_n uuid; v_o jsonb; v_msg text; v_type uuid; v_type2 uuid; v_plan uuid; v_room uuid;
begin
  -- A configured hotel
  perform t.login('adminA');
  v_o := public.setup_progress(t.id('propA'));
  perform t.eq(jsonb_array_length(v_o->'steps'), 7, '[SET-011] seven steps');
  perform t.eq((v_o->>'total')::int, 7, '[SET-011] total is seven');
  perform t.eq((v_o->>'done')::int, (select count(*)::int from jsonb_array_elements(v_o->'steps') s where (s->>'done')::boolean),
    '[SET-011] done counts the finished steps');
  perform t.ok((select (s->>'done')::boolean from jsonb_array_elements(v_o->'steps') s where s->>'key' = 'room_types'), '[SET-011] room types done in a configured hotel');
  perform t.ok((select (s->>'done')::boolean from jsonb_array_elements(v_o->'steps') s where s->>'key' = 'rooms'), '[SET-011] rooms done');
  perform t.ok((select (s->>'done')::boolean from jsonb_array_elements(v_o->'steps') s where s->>'key' = 'rates'), '[SET-011] rates done');
  perform t.ok((select (s->>'done')::boolean from jsonb_array_elements(v_o->'steps') s where s->>'key' = 'taxes'), '[SET-011] taxes done from the seeded defaults');
  perform t.ok((select (s->>'done')::boolean from jsonb_array_elements(v_o->'steps') s where s->>'key' = 'payments'), '[SET-011] payment methods done from the seeded defaults');
  perform t.ok((select (s->>'done')::boolean from jsonb_array_elements(v_o->'steps') s where s->>'key' = 'staff'), '[SET-011] staff done when other people hold a role here');
  perform t.ok((select bool_and(s ? 'label' and s ? 'href' and s ? 'detail') from jsonb_array_elements(v_o->'steps') s), '[SET-011] every step has a label, a detail and a link');

  -- A new, empty branch
  v_n := public.create_property('North Branch', 'Abuja', 'Nigeria');
  perform t.put('propN', v_n);
  select business_date into v_bd from public.properties where id = v_n;
  v_o := public.setup_progress(v_n);
  perform t.eq((v_o->>'complete')::boolean, false, '[SET-011] a new branch is not complete');
  perform t.ok(not (select (s->>'done')::boolean from jsonb_array_elements(v_o->'steps') s where s->>'key' = 'property'), '[SET-011] property step open until an address is saved');
  perform t.ok(not (select (s->>'done')::boolean from jsonb_array_elements(v_o->'steps') s where s->>'key' = 'room_types'), '[SET-011] no room types yet');
  perform t.ok(not (select (s->>'done')::boolean from jsonb_array_elements(v_o->'steps') s where s->>'key' = 'rooms'), '[SET-011] no rooms yet');
  perform t.ok(not (select (s->>'done')::boolean from jsonb_array_elements(v_o->'steps') s where s->>'key' = 'rates'), '[SET-011] no rates yet');

  perform public.update_property(v_n, 'North Branch', '12 Aminu Kano Crescent', 'Abuja', 'Nigeria', 'Africa/Lagos', '14:00', '12:00');
  v_o := public.setup_progress(v_n);
  perform t.ok((select (s->>'done')::boolean from jsonb_array_elements(v_o->'steps') s where s->>'key' = 'property'), '[SET-011] property step done once an address is saved');

  -- Room types, prices and rooms move the steps one at a time
  v_type := public.save_room_type(v_n, null, 'STD', 'Standard', 2, 0, null, true);
  v_o := public.setup_progress(v_n);
  perform t.ok((select (s->>'done')::boolean from jsonb_array_elements(v_o->'steps') s where s->>'key' = 'room_types'), '[SET-011] room types done after one is added');
  perform t.ok(not (select (s->>'done')::boolean from jsonb_array_elements(v_o->'steps') s where s->>'key' = 'rates'), '[SET-011] rates stay open while the room type has no price');
  perform t.eq((select s->>'detail' from jsonb_array_elements(v_o->'steps') s where s->>'key' = 'rates'), '0 of 1 room types have a price',
    '[SET-011] the rates step says how many room types are priced');

  v_plan := public.save_rate_plan(v_n, null, 'BAR', 'Best available', false, 'none', 0, 'none', 0, 'none', 0, true);
  perform public.save_rate_plan_price(null, v_plan, v_type, v_bd - 1, v_bd + 365, 40000, 'NGN');
  v_o := public.setup_progress(v_n);
  perform t.ok((select (s->>'done')::boolean from jsonb_array_elements(v_o->'steps') s where s->>'key' = 'rates'), '[SET-011] rates done once every room type is priced');

  v_type2 := public.save_room_type(v_n, null, 'DLX', 'Deluxe', 3, 1, null, true);
  v_o := public.setup_progress(v_n);
  perform t.ok(not (select (s->>'done')::boolean from jsonb_array_elements(v_o->'steps') s where s->>'key' = 'rates'), '[SET-011] a new unpriced room type reopens the rates step');
  perform t.eq((select s->>'detail' from jsonb_array_elements(v_o->'steps') s where s->>'key' = 'rates'), '1 of 2 room types have a price', '[SET-011] and the count follows');
  perform public.save_room_type(v_n, v_type2, 'DLX', 'Deluxe', 3, 1, null, false);
  v_o := public.setup_progress(v_n);
  perform t.ok((select (s->>'done')::boolean from jsonb_array_elements(v_o->'steps') s where s->>'key' = 'rates'), '[SET-011] a retired room type is not counted');

  v_room := public.save_room(v_n, null, '101', v_type, '1', true);
  v_o := public.setup_progress(v_n);
  perform t.ok((select (s->>'done')::boolean from jsonb_array_elements(v_o->'steps') s where s->>'key' = 'rooms'), '[SET-011] rooms done after one is added');
  perform public.save_room(v_n, v_room, '101', v_type, '1', false);
  v_o := public.setup_progress(v_n);
  perform t.ok(not (select (s->>'done')::boolean from jsonb_array_elements(v_o->'steps') s where s->>'key' = 'rooms'), '[SET-011] a retired room is not counted');

  -- A price that has already ended does not count
  perform public.save_room(v_n, v_room, '101', v_type, '1', true);
  perform t.admin();
  update public.rate_plan_prices set valid_to = (select business_date from public.properties where id = t.id('propN')) - 1 where room_type_id = v_type;
  perform t.login('adminA');
  v_o := public.setup_progress(t.id('propN'));
  perform t.ok(not (select (s->>'done')::boolean from jsonb_array_elements(v_o->'steps') s where s->>'key' = 'rates'), '[SET-011] a price that has ended does not count');

  -- Access
  perform t.login('fdo');
  begin perform public.setup_progress(t.id('propA')); exception when others then v_msg := sqlerrm; end;
  perform t.ok(v_msg like '[E_FORBIDDEN]%', '[SET-011] front desk without setup rights is refused');
  v_msg := null;
  perform t.login('adminA');
  begin perform public.setup_progress(t.id('propB')); exception when others then v_msg := sqlerrm; end;
  perform t.ok(v_msg like '[E_FORBIDDEN]%', '[SET-011] another hotel group is refused');
  perform t.admin();
  perform t.ok(not has_function_privilege('anon', 'public.setup_progress(uuid)', 'execute'), '[SET-011] visitors cannot call it');
  perform t.ok(has_function_privilege('authenticated', 'public.setup_progress(uuid)', 'execute'), '[SET-011] signed-in users can');
end $$;

rollback;

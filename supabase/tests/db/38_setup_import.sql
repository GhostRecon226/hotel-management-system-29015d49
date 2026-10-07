-- Setup import (SET-010) and its AI start (AI-006): add room types and rooms in one checked step.
-- The AI only drafts the list. This function checks everything and either adds all of it or nothing.
begin;

do $$
declare v_p uuid := t.id('propA'); v_std text; v_r jsonb; v_before int; v_rooms_before int; v_payload jsonb; v_suite uuid; v_n int;
begin
  select code into v_std from public.room_types where id = t.id('std');
  select count(*) into v_before from public.room_types where property_id = v_p;
  select count(*) into v_rooms_before from public.rooms where property_id = v_p;
  v_payload := jsonb_build_object(
    'room_types', jsonb_build_array(
      jsonb_build_object('code', 'suite', 'name', 'Executive Suite', 'max_adults', 3, 'max_children', 1),
      jsonb_build_object('code', 'TWIN', 'name', 'Twin Room')),
    'rooms', jsonb_build_array(
      jsonb_build_object('number', '701', 'type_code', 'SUITE', 'floor', '7'),
      jsonb_build_object('number', '702', 'type_code', 'SUITE', 'floor', '7'),
      jsonb_build_object('number', 'Garden 1', 'type_code', 'TWIN'),
      jsonb_build_object('number', '703', 'type_code', v_std, 'floor', '7'),
      jsonb_build_object('number', '701', 'type_code', 'SUITE')));

  perform t.login('adminA');
  -- preview writes nothing
  v_r := public.apply_setup_import(v_p, v_payload, true);
  perform t.eq((select count(*)::int from public.room_types where property_id = v_p), v_before, '[SET-010] a preview adds no room types');
  perform t.eq((select count(*)::int from public.rooms where property_id = v_p), v_rooms_before, '[SET-010] and no rooms');
  perform t.eq(jsonb_array_length(v_r->'would_create_types'), 2, '[SET-010] the preview lists the two new types');
  perform t.eq((v_r->>'would_create_rooms')::int, 4, '[SET-010] and four rooms (the repeated 701 is counted once)');
  perform t.eq((v_r->>'skipped_rooms')::int, 1, '[SET-010] the repeat is shown as skipped');

  -- apply
  v_r := public.apply_setup_import(v_p, v_payload, false);
  perform t.eq((v_r->>'created_types')::int, 2, '[SET-010] two types are created');
  perform t.eq((v_r->>'created_rooms')::int, 4, '[SET-010] four rooms are created');
  select id into v_suite from public.room_types where property_id = v_p and code = 'SUITE';
  perform t.ok(v_suite is not null, '[SET-010] the code is tidied to upper case');
  perform t.eq((select name from public.room_types where id = v_suite), 'Executive Suite', '[SET-010] the name is kept');
  perform t.eq((select max_adults from public.room_types where id = v_suite), 3, '[SET-010] the guest limits are kept');
  perform t.eq((select max_adults from public.room_types where property_id = v_p and code = 'TWIN'), 2, '[SET-010] a missing adults limit becomes 2');
  perform t.eq((select count(*)::int from public.rooms where property_id = v_p and room_type_id = v_suite), 2, '[SET-010] suites are on the suite type');
  perform t.eq((select room_type_id from public.rooms where property_id = v_p and room_number = '703'), t.id('std'), '[SET-010] rooms can use an existing type');
  perform t.eq((select floor from public.rooms where property_id = v_p and room_number = '701'), '7', '[SET-010] the floor is kept');
  perform t.ok(exists (select 1 from public.rooms where property_id = v_p and room_number = 'Garden 1'), '[SET-010] free-text room names work');

  -- safe to repeat
  v_r := public.apply_setup_import(v_p, v_payload, false);
  perform t.eq((v_r->>'created_types')::int, 0, '[SET-010] repeating creates no types');
  perform t.eq((v_r->>'created_rooms')::int, 0, '[SET-010] and no rooms');
  perform t.eq((select count(*)::int from public.rooms where property_id = v_p), v_rooms_before + 4, '[SET-010] the room count did not change');
  perform t.admin();
  perform t.ok(exists (select 1 from public.audit_events where action = 'apply_setup_import' and tenant_id = t.id('tenantA')), '[SET-010] the import is audited');

  -- refusals leave nothing behind
  perform t.login('adminA');
  v_n := (select count(*)::int from public.rooms where property_id = v_p);
  perform t.raises(format('select public.apply_setup_import(%L, %L::jsonb, false)', v_p,
    '{"room_types":[],"rooms":[{"number":"801","type_code":"NOPE"}]}'), 'E_INVALID', '[SET-010] an unknown room type is refused');
  perform t.raises(format('select public.apply_setup_import(%L, %L::jsonb, false)', v_p,
    '{"room_types":[],"rooms":[{"number":"801","type_code":"' || v_std || '"},{"number":"Room #5","type_code":"' || v_std || '"}]}'), 'E_INVALID',
    '[SET-010] one bad room name refuses the whole import');
  perform t.eq((select count(*)::int from public.rooms where property_id = v_p), v_n, '[SET-010] and 801 was not added');
  perform t.raises(format('select public.apply_setup_import(%L, %L::jsonb, false)', v_p, '{"rooms":"x"}'), 'E_INVALID', '[SET-010] a malformed list is refused');
  perform t.raises(format('select public.apply_setup_import(%L, null, false)', v_p), 'E_INVALID', '[SET-010] so is an empty one');
  perform t.raises(format('select public.apply_setup_import(%L, %L::jsonb, false)', v_p,
    (select jsonb_build_object('room_types', '[]'::jsonb, 'rooms', jsonb_agg(jsonb_build_object('number', 'X' || g, 'type_code', v_std)))::text from generate_series(1, 501) g)),
    'E_INVALID', '[SET-010] more than 500 rooms in one import is refused');
  perform t.raises(format('select public.apply_setup_import(%L, %L::jsonb, false)', v_p,
    (select jsonb_build_object('room_types', '[]'::jsonb, 'rooms', jsonb_agg(jsonb_build_object('number', 'Y' || g, 'type_code', v_std)))::text from generate_series(1, 300) g)),
    'E_PLAN_LIMIT', '[SET-010] going over the plan room limit is refused');
  perform t.eq((select count(*)::int from public.rooms where property_id = v_p), v_n, '[SET-010] and nothing was added');

  -- who may
  perform t.login('fdo');
  perform t.raises(format('select public.apply_setup_import(%L, %L::jsonb, true)', v_p, v_payload), 'E_FORBIDDEN', '[SET-010] front desk cannot import');
  perform t.login('adminB');
  perform t.raises(format('select public.apply_setup_import(%L, %L::jsonb, true)', v_p, v_payload), 'E_FORBIDDEN', '[SET-010] another hotel cannot import here');
  perform t.admin();
end $$;

-- AI-006: the AI start for the import
do $$
declare v_p uuid := t.id('propA'); v_s jsonb;
begin
  perform t.login('adminA');
  perform t.raises(format('select public.ai_import_start(%L)', v_p), 'E_AI_OFF', '[AI-006] the import assistant is off until AI is switched on');
  perform t.login('adminA');
  perform public.set_ai_settings(true, 1);
  perform t.login('adminA');
  v_s := public.ai_import_start(v_p);
  perform t.ok((v_s->>'usage_id') is not null, '[AI-006] starting returns a usage id');
  perform t.ok(v_s->'context'->'room_type_codes' @> to_jsonb((select code from public.room_types where id = t.id('std'))),
    '[AI-006] the context lists the existing room type codes');
  perform t.eq((select array_agg(k order by k) from jsonb_object_keys(v_s->'context') k), array['room_count', 'room_type_codes'],
    '[AI-006] the context holds only type codes and a room count');
  perform t.raises(format('select public.ai_import_start(%L)', v_p), 'E_AI_LIMIT', '[AI-006] the monthly limit applies');
  perform public.ai_call_finish((v_s->>'usage_id')::uuid, false);
  perform t.lives(format('select public.ai_import_start(%L)', v_p), '[AI-006] a failed call frees the slot');
  perform t.login('fdo');
  perform t.raises(format('select public.ai_import_start(%L)', v_p), 'E_FORBIDDEN', '[AI-006] front desk cannot start an import');
  perform t.login('adminB');
  perform t.raises(format('select public.ai_import_start(%L)', v_p), 'E_FORBIDDEN', '[AI-006] another hotel cannot');
  perform t.admin();
end $$;

select t.admin();
rollback;

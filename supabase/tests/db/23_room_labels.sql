-- Room labels are free text (decision of 6 Oct 2026, stage 1): numbers (101), prefixed numbers (A101), names
-- (Zurich) or a mix, up to 30 characters. Unique per hotel ignoring case and extra spaces. Natural order.
-- "Add several rooms": numbers mode (prefix + range) and names mode (one per line), both with a preview.
-- Requirement ROOM-005. Messages and new folio lines show the label as typed, without "Room" in front.
begin;

-- Hotel B gets one room type, so it starts with no rooms (Starter plan: 20 rooms).
do $$ begin
  perform t.login('adminB');
  perform t.put('typeB', public.save_room_type(t.id('propB'), null, 'DLX', 'Deluxe', 2, 0, null, true));
end $$;

-- Numbers mode: preview, prefix, range, no zero padding.
do $$
declare j jsonb;
begin
  perform t.login('adminB');
  j := public.add_rooms_range(t.id('propB'), 'A', 8, 10, t.id('typeB'), '1', true);
  perform t.eq(j->'would_create', '["A8","A9","A10"]'::jsonb, '[ROOM-005] the preview lists A8, A9, A10 (no zero padding)');
  perform t.eq((j->>'created')::int, 0, '[ROOM-005] a preview creates nothing');
  perform t.eq((select count(*)::int from public.rooms where property_id = t.id('propB')), 0, '[ROOM-005] no rooms after the preview');
  j := public.add_rooms_range(t.id('propB'), 'A', 8, 10, t.id('typeB'), '1', false);
  perform t.eq((j->>'created')::int, 3, '[ROOM-005] saving creates the three rooms');
  perform t.eq((select string_agg(room_number, ',' order by room_number collate app.natural) from public.rooms where property_id = t.id('propB')), 'A8,A9,A10',
    '[ROOM-005] stored as A8, A9, A10');
  perform t.eq((select count(*)::int from public.rooms where property_id = t.id('propB') and floor = '1'), 3, '[ROOM-005] on floor 1');
  j := public.add_rooms_range(t.id('propB'), 'a', 9, 11, t.id('typeB'), '1', false);
  perform t.eq(j->'skipped', '["a9","a10"]'::jsonb, '[ROOM-005] a9 and a10 already exist (case ignored) and are skipped');
  perform t.eq((j->>'created')::int, 1, '[ROOM-005] only a11 is created');
  j := public.add_rooms_range(t.id('propB'), null, 1, 2, t.id('typeB'), null, false);
  perform t.eq((j->>'created')::int, 2, '[ROOM-005] the prefix is optional: rooms 1 and 2');
  perform t.raises(format('select public.add_rooms_range(%L, %L, 1, 2, %L, null, true)', t.id('propB'), 'ABCDE', t.id('typeB')), 'E_INVALID', '[ROOM-005] a prefix is at most 4 characters');
  perform t.raises(format('select public.add_rooms_range(%L, %L, 1, 2, %L, null, true)', t.id('propB'), 'A-', t.id('typeB')), 'E_INVALID', '[ROOM-005] a prefix has letters and digits only');
  perform t.raises(format('select public.add_rooms_range(%L, null, 5, 2, %L, null, true)', t.id('propB'), t.id('typeB')), 'E_INVALID', '[ROOM-005] the range must run upwards');
  perform t.raises(format('select public.add_rooms_range(%L, null, 1, 501, %L, null, true)', t.id('propB'), t.id('typeB')), 'E_INVALID', '[ROOM-005] at most 500 rooms at a time (numbers)');
end $$;

-- Names mode: one per line, blank lines ignored, duplicates in the list and in the hotel skipped.
do $$
declare j jsonb; v_names text[];
begin
  perform t.login('adminB');
  j := public.add_rooms_named(t.id('propB'), array['Zurich', '', '  Boston ', 'zurich', 'Lake   View'], t.id('typeB'), null, true);
  perform t.eq(j->'would_create', '["Zurich","Boston","Lake View"]'::jsonb, '[ROOM-005] names preview: extra spaces tidied, blank line ignored');
  perform t.eq(j->'skipped', '["zurich"]'::jsonb, '[ROOM-005] a name repeated in the list (other case) is skipped');
  j := public.add_rooms_named(t.id('propB'), array['Zurich', '', '  Boston ', 'zurich', 'Lake   View'], t.id('typeB'), null, false);
  perform t.eq((j->>'created')::int, 3, '[ROOM-005] three named rooms are created');
  perform t.ok(exists (select 1 from public.rooms where property_id = t.id('propB') and room_number = 'Lake View'), '[ROOM-005] stored as typed, with single spaces');
  j := public.add_rooms_named(t.id('propB'), array['BOSTON', 'lake view'], t.id('typeB'), null, false);
  perform t.eq(j->'skipped', '["BOSTON","lake view"]'::jsonb, '[ROOM-005] names that exist in another case or spacing are skipped');
  perform t.eq((j->>'created')::int, 0, '[ROOM-005] and nothing is created');
  j := public.add_rooms_named(t.id('propB'), array['Paris', 'Room#1', 'A/B'], t.id('typeB'), null, true);
  perform t.eq(jsonb_array_length(j->'invalid'), 2, '[ROOM-005] the preview lists names with characters that are not allowed');
  perform t.raises(format('select public.add_rooms_named(%L, %L::text[], %L, null, false)', t.id('propB'), array['Paris', 'Room#1'], t.id('typeB')),
    'E_INVALID', '[ROOM-005] saving with a name that is not allowed is refused');
  perform t.ok(not exists (select 1 from public.rooms where property_id = t.id('propB') and room_number = 'Paris'), '[ROOM-005] and nothing from that list is created');
  select array_agg('N' || g) into v_names from generate_series(1, 501) g;
  perform t.raises(format('select public.add_rooms_named(%L, %L::text[], %L, null, true)', t.id('propB'), v_names, t.id('typeB')), 'E_INVALID', '[ROOM-005] at most 500 rooms at a time (names)');
end $$;

-- Label rules on every way in (save_room, both new modes, the old bulk add).
do $$
declare v30 text := 'Presidential Suite Lagoon Wing'; -- 30 characters
begin
  perform t.login('adminB');
  perform t.eq(char_length(v30), 30, 'the 30-character test name is 30 characters');
  perform t.lives(format('select public.save_room(%L, null, %L, %L, null, true)', t.id('propB'), v30, t.id('typeB')), '[ROOM-005] a 30-character name is accepted');
  perform t.raises(format('select public.save_room(%L, null, %L, %L, null, true)', t.id('propB'), v30 || 'X', t.id('typeB')), 'E_INVALID', '[ROOM-005] 31 characters is refused');
  perform t.lives(format('select public.save_room(%L, null, %L, %L, null, true)', t.id('propB'), 'Zürich', t.id('typeB')), '[ROOM-005] an accented name is accepted');
  perform t.ok(exists (select 1 from public.rooms where property_id = t.id('propB') and room_number = 'Zürich'), '[ROOM-005] Zürich and Zurich are different rooms');
  perform t.lives(format('select public.save_room(%L, null, %L, %L, null, true)', t.id('propB'), 'Ọṣun', t.id('typeB')), '[ROOM-005] a Yoruba name is accepted');
  perform t.lives(format('select public.save_room(%L, null, %L, %L, null, true)', t.id('propB'), 'O''Brien-2', t.id('typeB')), '[ROOM-005] apostrophes and hyphens are accepted');
  perform t.raises(format('select public.save_room(%L, null, %L, %L, null, true)', t.id('propB'), 'ZURICH', t.id('typeB')), 'E_DUPLICATE', '[ROOM-005] a name that differs only by case is refused');
  perform t.raises(format('select public.save_room(%L, null, %L, %L, null, true)', t.id('propB'), ' zurich  ', t.id('typeB')), 'E_DUPLICATE', '[ROOM-005] and so is one that differs only by spaces');
  perform t.raises(format('select public.save_room(%L, null, %L, %L, null, true)', t.id('propB'), 'Suite <1>', t.id('typeB')), 'E_INVALID', '[ROOM-005] symbols are refused');
  perform t.raises(format('select public.save_room(%L, null, %L, %L, null, true)', t.id('propB'), '   ', t.id('typeB')), 'E_REQUIRED', '[ROOM-005] a blank name is refused');
  perform t.eq(public.bulk_add_rooms(t.id('propB'), 900, 900, t.id('typeB'), null), 1, 'the old Bulk add in Setup still works');
end $$;

-- Plan limit: hotel B is on Starter (20 rooms). A batch that goes over is refused as a whole.
do $$
declare j jsonb; v_before int;
begin
  perform t.login('adminB');
  v_before := (select count(*)::int from public.rooms where property_id = t.id('propB') and is_active);
  j := public.add_rooms_range(t.id('propB'), 'B', 1, 30, t.id('typeB'), null, true);
  perform t.eq((j->>'room_limit')::int, 20, '[ROOM-005] the preview shows the plan room limit');
  perform t.eq((j->>'rooms_now')::int, v_before, '[ROOM-005] and how many rooms the hotel has now');
  perform t.raises(format('select public.add_rooms_range(%L, %L, 1, 30, %L, null, false)', t.id('propB'), 'B', t.id('typeB')), 'E_PLAN_LIMIT', '[ROOM-005] going over the plan limit is refused');
  perform t.eq((select count(*)::int from public.rooms where property_id = t.id('propB') and is_active), v_before, '[ROOM-005] and no room from that batch is created');
end $$;

-- Permissions and hotels.
do $$ begin
  perform t.login('fdo');
  perform t.raises(format('select public.add_rooms_range(%L, null, 1, 2, %L, null, true)', t.id('propA'), t.id('std')), 'E_FORBIDDEN', '[ROOM-005] front desk cannot add rooms (numbers)');
  perform t.raises(format('select public.add_rooms_named(%L, %L::text[], %L, null, true)', t.id('propA'), array['Zurich'], t.id('std')), 'E_FORBIDDEN', '[ROOM-005] front desk cannot add rooms (names)');
  perform t.login('adminB');
  perform t.raises(format('select public.add_rooms_range(%L, null, 1, 2, %L, null, true)', t.id('propA'), t.id('std')), 'E_FORBIDDEN', '[ROOM-005] another hotel cannot add rooms here');
  perform t.login('adminA');
  perform t.raises(format('select public.add_rooms_named(%L, %L::text[], %L, null, true)', t.id('propA'), array['Zurich'], t.id('typeB')), 'E_INVALID', '[ROOM-005] the room type must belong to this hotel');
end $$;

-- Natural order: 2 before 10, numbers before names, names A to Z.
do $$
declare v_type uuid; v_order text;
begin
  perform t.login('adminA');
  v_type := public.save_room_type(t.id('propA'), null, 'NAT', 'Natural', 2, 0, null, true);
  perform public.add_rooms_named(t.id('propA'), array['zurich', 'A10', '10', 'Boston', '2', 'A2'], v_type, null, false);
  select string_agg(room_number, ',') into v_order
  from public.get_front_desk_rooms(t.id('propA'), v_type, t.bdate(), t.bdate() + 1, null);
  perform t.eq(v_order, '2,10,A2,A10,Boston,zurich', '[ROOM-005] the front desk room list is in natural order');
end $$;

-- Messages and folio lines show the label as typed. Renaming a room never changes issued lines or invoices.
do $$
declare v_type uuid; v_room uuid; v_res uuid; v_f uuid; v_inv uuid; v_desc text;
begin
  perform t.login('adminA');
  v_type := public.save_room_type(t.id('propA'), null, 'CTY', 'City', 2, 0, null, true);
  perform public.save_rate_plan_price(null, t.id('bar'), v_type, t.bdate() - 5, t.bdate() + 30, 40000, 'NGN');
  v_room := public.save_room(t.id('propA'), null, 'Lisbon', v_type, '3', true);
  perform public.save_room(t.id('propA'), null, 'Porto', v_type, '3', true); -- so a second City booking is possible
  perform t.login('fdo');
  v_res := t.book(t.id('g2'), t.bdate(), t.bdate() + 2, v_type, t.id('bar'));
  perform public.check_in(v_res, t.reg(), v_room, null, null);
  perform t.login('adminA');
  perform public.post_room_charges(t.id('propA'), null);
  v_f := t.main_folio(v_res);
  select description into v_desc from public.folio_transactions where folio_id = v_f and kind = 'charge' order by posted_at limit 1;
  perform t.eq(v_desc, 'Lisbon · ' || to_char(t.bdate(), 'DD Mon YYYY'), '[ROOM-005] the room charge line shows the label as typed');
  v_inv := public.issue_invoice(v_f, 'interim', 'lbl-inv-1');
  perform public.save_room(t.id('propA'), v_room, 'Lisbon Garden', v_type, '3', true);
  perform t.eq((select description from public.folio_transactions where folio_id = v_f and kind = 'charge' order by posted_at limit 1), v_desc,
    '[ROOM-005] renaming the room does not change the posted line');
  perform t.eq((select header->>'room_number' from public.invoices where id = v_inv), 'Lisbon', '[ROOM-005] nor the room on the issued invoice');
  perform t.login('fdo');
  perform t.raises(format('select public.check_in(%L, %L::jsonb, %L, null, null)',
      t.book(t.id('g3'), t.bdate(), t.bdate() + 1, v_type, t.id('bar')), t.reg(), v_room),
    '] Lisbon Garden is ', '[ROOM-005] the message starts with the label as typed, not "Room"');
end $$;

rollback;

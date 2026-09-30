-- A room move creates a cleaning task for the room the guest left (requirements FO-006, HK-001).
--
-- Before: the old room was marked dirty but no task was made, so housekeeping never learned about it.
-- After: an open, high-priority turnover task is created for the old room, linked to the stay that left it,
-- the same way check-out does it (app.hk_new_turnover).

create or replace function public.move_room(p_id uuid, p_room_id uuid, p_reason text, p_room_override_reason text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; s public.stays; rm public.rooms; old_rm public.rooms; v_bdate date; v_from date; v_stay uuid;
begin
  r := app.reservation_for_write(p_id, 'fo.room.move');
  if r.status <> 'checked_in' then perform app.fail('E_INVALID', 'Only in-house guests can be moved.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  select * into s from public.stays where reservation_id = p_id and status = 'in_house' for update;
  if s.room_id = p_room_id then perform app.fail('E_INVALID', 'The guest is already in this room.'); end if;
  select business_date into v_bdate from public.properties where id = r.property_id;
  v_from := greatest(v_bdate, r.arrival_date);
  if v_from >= r.departure_date then perform app.fail('E_INVALID', 'The guest departs today. Check them out instead.'); end if;

  rm := app.check_arrival_room(r.property_id, p_room_id, p_room_override_reason);
  if rm.room_type_id <> r.room_type_id then
    perform app.assert_available(r.property_id, rm.room_type_id, v_from, r.departure_date, p_id);
  end if;

  update public.room_assignments set is_active = false, released_at = now() where reservation_id = p_id and is_active;
  begin
    insert into public.room_assignments(tenant_id, property_id, reservation_id, room_id, from_date, to_date)
    values (r.tenant_id, r.property_id, p_id, p_room_id, v_from, r.departure_date);
    update public.reservation_nights set room_id = null where reservation_id = p_id and stay_date >= v_from;
    update public.reservation_nights set room_id = p_room_id, room_type_id = rm.room_type_id
    where reservation_id = p_id and stay_date >= v_from;
  exception when exclusion_violation or unique_violation then
    perform app.fail('E_ROOM_TAKEN', 'Room ' || rm.room_number || ' is assigned to another stay on these dates.');
  end;
  if rm.room_type_id <> r.room_type_id then
    update public.reservations set room_type_id = rm.room_type_id, updated_at = now() where id = p_id;
  end if;

  select * into old_rm from public.rooms where id = s.room_id;
  update public.stays set status = 'moved', checked_out_at = now() where id = s.id;
  update public.rooms set is_occupied = false, condition = 'dirty' where id = s.room_id;
  perform app.hk_new_turnover(s.room_id, s.id, 'Room move ' || r.number);
  insert into public.stays(tenant_id, property_id, reservation_id, room_id, business_date, registration, room_override_reason)
  values (r.tenant_id, r.property_id, p_id, p_room_id, v_bdate, s.registration,
    case when app.room_ready(rm) then null else btrim(p_room_override_reason) end)
  returning id into v_stay;
  update public.rooms set is_occupied = true where id = p_room_id;
  perform app.log_res(r, 'move_room', p_reason, jsonb_build_object('from_room', old_rm.room_number, 'room_number', rm.room_number));
  return v_stay;
end $$;

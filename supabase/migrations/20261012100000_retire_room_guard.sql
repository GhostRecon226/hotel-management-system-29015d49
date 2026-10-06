-- Retire-room guard (SET-003, Peter's decision of 6 Oct 2026).
--
-- Before: save_room could retire a room while a guest was staying in it.
-- After: retiring an in-use room that has an in-house guest is refused with [E_ROOM_OCCUPIED] "This room has a guest
-- in it. Retire it after check-out." Only the change from in use to retired is checked: a room that is already
-- retired can be saved as retired again (safe to repeat), and renaming or moving an occupied room still works.
-- Otherwise save_room is its current definition from 20261006100000_free_text_room_labels.sql: permission check first,
-- security definer, fixed search path. Future bookings assigned to a retired room are not checked (open question).

create or replace function public.save_room(
  p_property_id uuid, p_id uuid, p_room_number text, p_room_type_id uuid, p_floor text, p_is_active boolean)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_tenant uuid;
begin
  perform app.require('setup.room.manage', p_property_id);
  if coalesce(btrim(p_room_number), '') = '' then perform app.fail('E_REQUIRED', 'Room name or number is required.'); end if;
  if not exists (select 1 from public.room_types where id = p_room_type_id and property_id = p_property_id) then
    perform app.fail('E_INVALID', 'Choose a room type for this property.'); end if;
  select tenant_id into v_tenant from public.properties where id = p_property_id;
  begin
    if p_id is null then
      insert into public.rooms(tenant_id, property_id, room_number, room_type_id, floor, is_active)
      values (v_tenant, p_property_id, p_room_number, p_room_type_id, nullif(btrim(p_floor), ''), coalesce(p_is_active, true))
      returning id into v_id;
    else
      -- SET-003: a room with a guest in it right now cannot be retired; check the guest out first. Only the change
      -- from in use to retired is checked, so retiring a room that is already retired works as before.
      if not coalesce(p_is_active, true)
         and exists (select 1 from public.rooms where id = p_id and property_id = p_property_id and is_active)
         and exists (select 1 from public.stays where room_id = p_id and status = 'in_house') then
        perform app.fail('E_ROOM_OCCUPIED', 'This room has a guest in it. Retire it after check-out.'); end if;
      update public.rooms set room_number = p_room_number, room_type_id = p_room_type_id,
        floor = nullif(btrim(p_floor), ''), is_active = coalesce(p_is_active, true)
      where id = p_id and property_id = p_property_id returning id into v_id;
      if v_id is null then perform app.fail('E_NOT_FOUND', 'Room not found.'); end if;
    end if;
  exception when unique_violation then
    perform app.fail('E_DUPLICATE', 'A room with that name or number already exists: ' || app.room_label(p_room_number));
  end;
  return v_id;
end $$;

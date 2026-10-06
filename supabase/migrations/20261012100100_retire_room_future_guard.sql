-- Retire-room guard, future bookings (SET-003, Peter's decision of 6 Oct 2026). Adds to 20261012100000.
--
-- Before: save_room refused to retire a room with a guest in it, but a room with upcoming bookings assigned to it could
-- be retired; the guest was then refused at check-in on the arrival day and front desk had to move the booking.
-- After: retiring an in-use room is also refused while upcoming bookings are assigned to it, with [E_ROOM_BOOKED]
-- "<room> has 2 upcoming bookings (RES-000123, RES-000140). Move them to another room first." Up to 5 numbers are named,
-- in arrival order, then "and N more". Upcoming means confirmed, or tentative with a hold not yet expired (the same
-- rule as availability), assigned to the room from the business date forward. Cancelled, no-show, checked-out and
-- expired tentative bookings do not count. The in-house check stays first. The room label is shown as typed, without
-- "Room " in front (ROOM-005). Retiring a room that is already retired, renaming and floor changes work as before.
-- Otherwise save_room is its definition from 20261012100000_retire_room_guard.sql: permission check first, security
-- definer, fixed search path.

create or replace function public.save_room(
  p_property_id uuid, p_id uuid, p_room_number text, p_room_type_id uuid, p_floor text, p_is_active boolean)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_tenant uuid; v_bdate date; v_label text; v_n int; v_list text;
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
      -- SET-003: nor while upcoming bookings are assigned to it: confirmed, or tentative with a hold not yet expired (the
      -- same rule as availability), assigned from the business date forward. Checked after the in-house guard.
      if not coalesce(p_is_active, true)
         and exists (select 1 from public.rooms where id = p_id and property_id = p_property_id and is_active) then
        select business_date into v_bdate from public.properties where id = p_property_id;
        select count(*), string_agg(x.number, ', ' order by x.arrival_date, x.number) filter (where x.rn <= 5)
          into v_n, v_list
        from (select r.number, r.arrival_date, row_number() over (order by r.arrival_date, r.number) as rn
              from public.room_assignments a join public.reservations r on r.id = a.reservation_id
              where a.room_id = p_id and a.is_active and a.to_date > v_bdate
                and (r.status = 'confirmed' or (r.status = 'tentative' and (r.hold_until is null or r.hold_until > now())))) x;
        if v_n > 0 then
          select room_number into v_label from public.rooms where id = p_id;
          perform app.fail('E_ROOM_BOOKED', format('%s has %s upcoming booking%s (%s%s). Move %s to another room first.',
            v_label, v_n, case when v_n = 1 then '' else 's' end, v_list,
            case when v_n > 5 then format(' and %s more', v_n - 5) else '' end, case when v_n = 1 then 'it' else 'them' end));
        end if;
      end if;
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

-- SRC-001: one search for the top bar. Finds guests, bookings and rooms from any screen.
-- Each part follows the same permission as its own screen: guests need guest.view, bookings need res.view for the
-- property, rooms need access to the property. A part the user may not see comes back empty, never as an error.
-- At most 5 of each. A query shorter than 2 letters returns nothing.

create function public.search_everything(p_property_id uuid, p_query text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_q text := btrim(coalesce(p_query, '')); v_guests jsonb := '[]'; v_res jsonb := '[]'; v_rooms jsonb := '[]';
begin
  if app.my_tenant() is null then perform app.fail('E_FORBIDDEN', 'Sign in to search.'); end if;
  if length(v_q) < 2 then return jsonb_build_object('guests', v_guests, 'reservations', v_res, 'rooms', v_rooms); end if;

  if app.can('guest.view', null) then
    select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', btrim(s.first_name || ' ' || s.last_name),
      'phone', s.phone, 'email', s.email)), '[]') into v_guests from public.search_guests(v_q, 5) s;
  end if;

  if p_property_id is not null and app.can('res.view', p_property_id) then
    select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'number', s.number, 'guest_name', s.guest_name,
      'arrival_date', s.arrival_date, 'departure_date', s.departure_date, 'status', s.status, 'room_number', s.room_number)), '[]')
    into v_res from public.search_reservations(p_property_id, v_q, null, null, null, 5) s;
  end if;

  if p_property_id is not null and app.has_property_access(p_property_id) then
    select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'room_number', x.room_number, 'room_type', x.code) order by x.ord), '[]')
    into v_rooms
    from (
      select r.id, r.room_number, rt.code, row_number() over (order by r.room_number collate app.natural) as ord
      from public.rooms r join public.room_types rt on rt.id = r.room_type_id
      where r.property_id = p_property_id and r.tenant_id = app.my_tenant() and r.is_active
        and lower(r.room_number) like '%' || lower(v_q) || '%'
      order by r.room_number collate app.natural limit 5
    ) x;
  end if;

  return jsonb_build_object('guests', v_guests, 'reservations', v_res, 'rooms', v_rooms);
end $$;
revoke all on function public.search_everything(uuid, text) from public, anon;
grant execute on function public.search_everything(uuid, text) to authenticated;

-- Guided first setup (SET-011). One read-only function tells a hotel what is left to set up, from the data it already
-- has. No new table and no stored progress, so the list is always right and cannot go stale.
-- Seven steps: property details, room types, rooms, rates, taxes, payment methods, staff.
-- A step is done when: the property has an address; at least one room type is in use; at least one room is in use;
-- every room type in use has a price that has not ended on an active rate plan; at least one tax rate is on; at least
-- one payment method is on; at least two people hold a role at the property.
-- Access: any setup permission at the property (same people who see the Setup menu). Others get [E_FORBIDDEN].
-- It does not write, so it also works while a hotel is read-only.

create or replace function public.setup_progress(p_property_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_bd date; v_types int; v_priced int; v_rooms int; v_taxes int; v_pay int; v_people int; v_addr boolean;
  v_steps jsonb; v_done int;
begin
  if not (app.can('setup.property.view', p_property_id) or app.can('setup.property.edit', p_property_id)
       or app.can('setup.room.manage', p_property_id) or app.can('setup.rate.manage', p_property_id)
       or app.can('setup.tax.manage', p_property_id)) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to do this.');
  end if;
  select business_date, coalesce(btrim(address), '') <> '' into v_bd, v_addr
    from public.properties where id = p_property_id and tenant_id = app.my_tenant();
  if v_bd is null then perform app.fail('E_NOT_FOUND', 'Property not found.'); end if;

  select count(*) into v_types from public.room_types where property_id = p_property_id and is_active;
  select count(*) into v_rooms from public.rooms where property_id = p_property_id and is_active;
  select count(*) into v_priced from public.room_types rt
    where rt.property_id = p_property_id and rt.is_active
      and exists (select 1 from public.rate_plan_prices pr join public.rate_plans rp on rp.id = pr.rate_plan_id
                  where pr.room_type_id = rt.id and rp.is_active and pr.valid_to >= v_bd);
  select count(*) into v_taxes from public.tax_rates where property_id = p_property_id and is_active;
  select count(*) into v_pay from public.payment_methods where property_id = p_property_id and is_active;
  select count(distinct upr.user_id) into v_people from public.user_property_roles upr
    join public.profiles pf on pf.id = upr.user_id and pf.status = 'active' where upr.property_id = p_property_id;

  v_steps := jsonb_build_array(
    jsonb_build_object('key', 'property', 'label', 'Property details', 'href', '/setup/property', 'done', v_addr,
      'detail', case when v_addr then 'Address saved' else 'Add your address and check-in times' end),
    jsonb_build_object('key', 'room_types', 'label', 'Room types', 'href', '/setup/room-types', 'done', v_types > 0,
      'detail', case when v_types = 0 then 'No room types yet' when v_types = 1 then '1 room type' else v_types || ' room types' end),
    jsonb_build_object('key', 'rooms', 'label', 'Rooms', 'href', '/setup/rooms', 'done', v_rooms > 0,
      'detail', case when v_rooms = 0 then 'No rooms yet' when v_rooms = 1 then '1 room' else v_rooms || ' rooms' end),
    jsonb_build_object('key', 'rates', 'label', 'Rate plans and prices', 'href', '/setup/rates', 'done', v_types > 0 and v_priced = v_types,
      'detail', case when v_types = 0 then 'Add a room type first' else v_priced || ' of ' || v_types || ' room types have a price' end),
    jsonb_build_object('key', 'taxes', 'label', 'Taxes', 'href', '/setup/charges', 'done', v_taxes > 0,
      'detail', case when v_taxes = 0 then 'No taxes switched on' when v_taxes = 1 then '1 tax switched on' else v_taxes || ' taxes switched on' end),
    jsonb_build_object('key', 'payments', 'label', 'Payment methods', 'href', '/setup/charges', 'done', v_pay > 0,
      'detail', case when v_pay = 0 then 'No payment methods' when v_pay = 1 then '1 payment method' else v_pay || ' payment methods' end),
    jsonb_build_object('key', 'staff', 'label', 'Staff', 'href', '/admin', 'done', v_people >= 2,
      'detail', case when v_people >= 2 then v_people || ' people have a role here' else 'Only you so far. Invite your team.' end));
  select count(*) into v_done from jsonb_array_elements(v_steps) s where (s->>'done')::boolean;
  return jsonb_build_object('property_id', p_property_id, 'total', 7, 'done', v_done, 'complete', v_done = 7, 'steps', v_steps);
end $$;

revoke all on function public.setup_progress(uuid) from public, anon;
grant execute on function public.setup_progress(uuid) to authenticated;

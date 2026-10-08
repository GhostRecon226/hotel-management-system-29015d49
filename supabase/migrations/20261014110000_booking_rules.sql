-- SET-012: booking rules screen. The longest stay and the tentative hold time already exist on
-- properties (max_stay_nights, tentative_hold_hours). This adds the one function that changes them.
create or replace function public.set_booking_rules(p_property_id uuid, p_max_stay_nights integer, p_tentative_hold_hours integer)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare b public.properties;
begin
  perform app.assert_writable();
  perform app.require('setup.property.edit', p_property_id);
  select * into b from public.properties where id = p_property_id and tenant_id = app.my_tenant();
  if b.id is null then perform app.fail('E_NOT_FOUND', 'Property not found.'); end if;
  if p_max_stay_nights is null or p_max_stay_nights < 1 or p_max_stay_nights > 365 then
    perform app.fail('E_INVALID', 'The longest stay must be between 1 and 365 nights.'); end if;
  if p_tentative_hold_hours is null or p_tentative_hold_hours < 1 or p_tentative_hold_hours > 720 then
    perform app.fail('E_INVALID', 'The hold time must be between 1 and 720 hours.'); end if;
  update public.properties set max_stay_nights = p_max_stay_nights, tentative_hold_hours = p_tentative_hold_hours
  where id = p_property_id;
  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, before, after)
  values (app.my_tenant(), auth.uid(), 'set_booking_rules', 'properties', p_property_id::text,
    jsonb_build_object('max_stay_nights', b.max_stay_nights, 'tentative_hold_hours', b.tentative_hold_hours),
    jsonb_build_object('max_stay_nights', p_max_stay_nights, 'tentative_hold_hours', p_tentative_hold_hours));
end $$;
revoke all on function public.set_booking_rules(uuid, integer, integer) from public, anon;
grant execute on function public.set_booking_rules(uuid, integer, integer) to authenticated;

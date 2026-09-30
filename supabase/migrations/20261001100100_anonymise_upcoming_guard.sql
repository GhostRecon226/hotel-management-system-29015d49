-- A guest with a booking that is not over cannot be anonymised (requirement GST-005).
--
-- Before: anonymising wiped the name and contact details even when the guest was arriving next week or was
-- in the hotel, so the desk would check in "Anonymised Guest" with no phone number.
-- After: refused with E_IN_USE while the guest has a tentative, confirmed or checked-in booking. Cancel the
-- booking (or check the guest out) first. Past, cancelled and no-show bookings do not block it.

create or replace function public.anonymise_guest(p_guest uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid := app.my_tenant();
begin
  perform app.require_any('guest.anonymise');
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  perform app.guest_for_write(p_guest);
  if exists (select 1 from public.reservations
             where guest_id = p_guest and status in ('tentative', 'confirmed', 'checked_in')) then
    perform app.fail('E_IN_USE', 'This guest has a booking that is not over. Cancel it or check the guest out first.');
  end if;

  perform set_config('app.skip_guest_audit', 'on', true);
  delete from public.guest_documents where guest_id = p_guest;
  update public.guest_feedback set text = '[Removed when the guest was anonymised]' where guest_id = p_guest;
  update public.guests set first_name = 'Anonymised', last_name = 'Guest', phone = null, email = null,
    nationality = null, address = null, notes = null, anonymised_at = now(), updated_at = now()
  where id = p_guest;
  perform set_config('app.skip_guest_audit', '', true);

  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, reason)
  values (v_tenant, auth.uid(), 'anonymise_guest', 'guests', p_guest::text, btrim(p_reason));
end $$;

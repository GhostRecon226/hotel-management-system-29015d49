-- Voiding a check-in made by mistake leaves the room ready (requirement FO-012).
--
-- Before: voiding marked the room dirty, so the guest could not be checked in again until housekeeping
-- cleaned a room nobody had used.
-- After: the room is freed and keeps its condition. Check-in never changes the condition, so a room that was
-- clean or inspected stays that way. If housekeeping marked it dirty in the meantime, it stays dirty.

create or replace function public.void_check_in(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; s public.stays; v_bdate date;
begin
  r := app.reservation_for_write(p_id, 'fo.checkin.void');
  if r.status <> 'checked_in' then perform app.fail('E_INVALID', 'Only in-house bookings can have their check-in voided.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  if exists (select 1 from public.stays where reservation_id = p_id and status = 'moved') then
    perform app.fail('E_INVALID', 'This guest has moved rooms, so the check-in cannot be voided.'); end if;
  select * into s from public.stays where reservation_id = p_id and status = 'in_house' for update;
  select business_date into v_bdate from public.properties where id = r.property_id;
  if s.business_date <> v_bdate then perform app.fail('E_INVALID', 'A check-in can only be voided on the day it was made.'); end if;
  update public.stays set status = 'voided', checked_out_at = now(), void_reason = btrim(p_reason) where id = s.id;
  update public.rooms set is_occupied = false where id = s.room_id;
  perform set_config('app.audit_reason', btrim(p_reason), true);
  update public.reservations set status = 'confirmed', updated_at = now() where id = p_id;
  perform set_config('app.audit_reason', '', true);
  perform app.log_res(r, 'void_check_in', p_reason, null);
end $$;

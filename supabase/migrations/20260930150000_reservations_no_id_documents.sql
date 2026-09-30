-- Reservation officers do not see guests' ID documents (decision 6b, requirement GST-002).
--
-- Before: the Reservation Officer role held guest.document.view, so it saw full passport and ID numbers.
-- After: the permission is removed from the built-in role. get_guest already masks document numbers for
-- anyone without it, and guest_documents has no direct read rule, so nothing else changes.
-- Front desk and managers keep it: they record ID at check-in.

delete from public.role_permissions
where permission_key = 'guest.document.view'
  and role_id = (select id from public.roles where tenant_id is null and code = 'RES');

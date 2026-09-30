-- Closing a maintenance ticket frees its room (requirement MNT-002, remaining failure 20).
--
-- Before: closing a resolved ticket left its room block in place, so the room stayed out of sale.
-- After: closing releases every open block linked to the ticket, the same way the Release button does.

CREATE OR REPLACE FUNCTION public.close_ticket(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare t public.maintenance_tickets;
begin
  perform app.assert_writable();
  t := app.mnt_ticket_for_write(p_id);
  perform app.require('mnt.ticket.close', t.property_id);
  if t.status <> 'resolved' then perform app.fail('E_INVALID', 'Only resolved tickets can be closed.'); end if;
  if t.resolved_by = auth.uid() then
    perform app.fail('E_SOD', 'You resolved this ticket, so someone else must check and close it.'); end if;
  update public.maintenance_tickets set status = 'closed', closed_by = auth.uid(), closed_at = now(), updated_at = now() where id = t.id;
  -- The repair is done: free the room. Approved blocks are released, blocks still waiting are cancelled.
  update public.room_blocks
     set status = case when status = 'approved' then 'released' else 'cancelled' end,
         released_by = auth.uid(), released_at = now(), release_reason = 'Ticket closed'
   where ticket_id = t.id and status in ('pending', 'approved');
end $function$;

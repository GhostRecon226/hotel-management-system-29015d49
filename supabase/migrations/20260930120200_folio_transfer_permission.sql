-- Moving charges between folios is a manager action (requirement FIN-009, remaining failure 2).
--
-- Before: anyone who could post charges (front desk included) could move a posted charge to another
-- folio of the stay, for example from the guest's folio to a company folio, with no manager involved.
-- After: a new permission fin.folio.transfer is required, both for a single transfer and for rows moved
-- while splitting a folio. It is given to System Administrator, General Manager, Front Office Manager
-- and Accountant. Splitting a folio without moving rows still only needs "post charges".

insert into public.permissions(key, description, module)
values ('fin.folio.transfer', 'Move posted rows between folios of a stay', 'finance')
on conflict (key) do nothing;

insert into public.role_permissions(role_id, permission_key, grant_level, tenant_id)
select r.id, 'fin.folio.transfer', 'Y', null from public.roles r
where r.tenant_id is null and r.code in ('SYSADMIN', 'GM', 'FOM', 'ACCT')
on conflict do nothing;

CREATE OR REPLACE FUNCTION app.do_transfer(p_id uuid, p_to uuid, p_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare t public.folio_transactions; src public.folios; dst public.folios; v_out uuid; v_in uuid; v_orig_kind text;
begin
  select * into t from public.folio_transactions where id = p_id and tenant_id = app.my_tenant();
  if t.id is null then perform app.fail('E_NOT_FOUND', 'Transaction not found.'); end if;
  if t.folio_id = p_to then perform app.fail('E_INVALID', 'Choose a different folio.'); end if;
  if t.folio_id < p_to then
    src := app.folio_for_write(t.folio_id, 'fin.charge.post'); dst := app.folio_for_write(p_to, 'fin.charge.post');
  else
    dst := app.folio_for_write(p_to, 'fin.charge.post'); src := app.folio_for_write(t.folio_id, 'fin.charge.post');
  end if;
  -- Moving a posted row changes who owes it, so it needs its own permission (managers), not just "post charges".
  perform app.require('fin.folio.transfer', src.property_id);
  if src.reservation_id <> dst.reservation_id then perform app.fail('E_INVALID', 'Transfers are only allowed between folios of the same stay.'); end if;
  select kind into v_orig_kind from public.folio_transactions where id = t.original_id;
  if not (t.kind in ('charge', 'payment') or (t.kind = 'transfer' and v_orig_kind = 'transfer')) then
    perform app.fail('E_INVALID', 'This row cannot be transferred.'); end if;
  if exists (select 1 from public.folio_transactions x where x.original_id = t.id and x.kind in ('reversal', 'transfer')) then
    perform app.fail('E_ALREADY_REVERSED', 'This row has already been reversed or transferred.'); end if;
  if exists (select 1 from public.folio_transactions d where d.original_id = t.id and d.kind = 'discount') then
    perform app.fail('E_INVALID', 'Charges with a discount cannot be moved.'); end if;
  begin
    v_out := app.post_mirror(t, 'transfer', src.id, -1, t.id, p_key, 'Moved to folio ' || dst.number || ': ' || coalesce(t.description, ''));
    select * into t from public.folio_transactions where id = p_id;
    v_in := app.post_mirror(t, 'transfer', dst.id, 1, v_out, p_key || ':in', 'Moved from folio ' || src.number || ': ' || coalesce(t.description, ''));
  exception when unique_violation then
    perform app.fail('E_ALREADY_REVERSED', 'This row has already been reversed or transferred.');
  end;
  return v_in;
end $function$;

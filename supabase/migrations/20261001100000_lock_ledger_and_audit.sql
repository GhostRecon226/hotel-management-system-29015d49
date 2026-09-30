-- The ledger and the audit trail cannot be changed, deleted or wiped by anyone, including the database owner
-- (requirements FIN-006, FIN-014, ADM-006).
--
-- Before: row triggers stopped UPDATE and DELETE on the ledger, but TRUNCATE wiped it in one command. The audit
-- trail had no protection at all against the owner. A direct insert by the owner could be backdated or carry the
-- wrong sign.
-- After:
--   * audit_events: no UPDATE, DELETE or TRUNCATE (also through TRUNCATE ... CASCADE from another table).
--   * folio_transactions and folio_tax_lines: no TRUNCATE either.
--   * A ledger row must carry its property's current business date.
--   * Charges and refunds are never negative. Payments and discounts are never positive.
-- The only way to correct the ledger stays the same: post a reversal or an adjustment.
-- Note: a database superuser can still switch triggers off. On Supabase the project owner is not a superuser.

create or replace function app.block_audit_change()
returns trigger language plpgsql as $$
begin
  perform app.fail('E_IMMUTABLE', 'The audit trail cannot be changed or deleted.');
  return null;
end $$;

create trigger audit_events_immutable before update or delete on public.audit_events
  for each row execute function app.block_audit_change();
create trigger audit_events_no_truncate before truncate on public.audit_events
  for each statement execute function app.block_audit_change();
create trigger folio_transactions_no_truncate before truncate on public.folio_transactions
  for each statement execute function app.block_ledger_change();
create trigger folio_tax_lines_no_truncate before truncate on public.folio_tax_lines
  for each statement execute function app.block_ledger_change();

-- Audit rows no longer hold guest values (migration 20260930110200), so anonymising a guest has nothing to
-- scrub in them. It used to blank before/after on the guest's audit rows; that update is removed.
create or replace function public.anonymise_guest(p_guest uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid := app.my_tenant();
begin
  perform app.require_any('guest.anonymise');
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  perform app.guest_for_write(p_guest);

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

-- Every ledger row belongs to the business date that is open when it is posted.
create or replace function app.ledger_business_date()
returns trigger language plpgsql as $$
declare v_date date;
begin
  select business_date into v_date from public.properties where id = new.property_id;
  if new.business_date is distinct from v_date then
    perform app.fail('E_DATE', 'Transactions can only be posted to the open business date.');
  end if;
  return new;
end $$;

create trigger folio_transactions_business_date before insert on public.folio_transactions
  for each row execute function app.ledger_business_date();

alter table public.folio_transactions add constraint folio_transactions_sign check (
  case kind
    when 'charge'   then amount >= 0
    when 'refund'   then amount >= 0
    when 'payment'  then amount <= 0
    when 'discount' then amount <= 0
    else true
  end);

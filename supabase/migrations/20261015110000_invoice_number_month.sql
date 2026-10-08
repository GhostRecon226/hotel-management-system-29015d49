-- FIN-020: invoice and interim invoice numbers carry the year and month of the hotel's business date.
-- Shape: INV-202610-000001 and INT-202610-000001. The count restarts at 1 each month and never skips inside a month.
-- Reservation and folio numbers are unchanged. Invoices already issued keep their numbers.
-- The period is stored with each sequence, so two invoices issued at the same time cannot get the same number
-- (the row lock in the update decides who goes first).

alter table public.document_sequences add column if not exists period_key text;

create or replace function app.next_document_number(p_property_id uuid, p_doc_type text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prefix text; v_num bigint; v_pad int; v_period text;
begin
  if p_doc_type in ('invoice', 'interim') then
    select to_char(business_date, 'YYYYMM') into v_period from public.properties where id = p_property_id;
  end if;
  update public.document_sequences
     set period_key = v_period,
         next_number = case when period_key is distinct from v_period then 2 else next_number + 1 end
   where property_id = p_property_id and doc_type = p_doc_type
  returning prefix, next_number - 1, padding into v_prefix, v_num, v_pad;
  if v_num is null then
    perform app.fail('E_NOT_FOUND', 'No number sequence set up for ' || p_doc_type || '.');
  end if;
  return v_prefix || case when v_period is null then '' else v_period || '-' end || lpad(v_num::text, v_pad, '0');
end $$;
revoke all on function app.next_document_number(uuid, text) from public, anon, authenticated;
grant execute on function app.next_document_number(uuid, text) to service_role;

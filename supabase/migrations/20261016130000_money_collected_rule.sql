-- RPT-009: one rule for "money collected".
-- A ledger row moves money in or out of the till when it is a payment or a refund, or when it is a reversal or a
-- transfer that carries a payment method. The invoice and the owner summary already used this rule. The Payments
-- report counted only payments and refunds, so a payment reversed the same day still showed as collected.
-- This adds the rule as one helper and makes the Payments report use it.

create or replace function app.is_money_movement(p_kind text, p_payment_method_id uuid)
returns boolean language sql immutable set search_path = public, pg_temp as $$
  select p_kind in ('payment', 'refund') or (p_kind in ('reversal', 'transfer') and p_payment_method_id is not null)
$$;
revoke all on function app.is_money_movement(text, uuid) from public, anon, authenticated;

create or replace function public.report_payments(p_property_id uuid, p_from date, p_to date)
returns table(business_date date, method text, kind text, payments numeric, refunds numeric, net numeric, count bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform app.require_report('rpt.finance.view', p_property_id);
  return query
  select t.business_date, coalesce(m.name, 'Other'), coalesce(m.kind, 'other'),
    coalesce(-sum(t.base_amount) filter (where t.kind <> 'refund'), 0)::numeric,
    coalesce(sum(t.base_amount) filter (where t.kind = 'refund'), 0)::numeric,
    (-coalesce(sum(t.base_amount), 0))::numeric, count(*)
  from public.folio_transactions t left join public.payment_methods m on m.id = t.payment_method_id
  where t.property_id = p_property_id and t.business_date between p_from and p_to
    and app.is_money_movement(t.kind, t.payment_method_id)
  group by t.business_date, m.name, m.kind
  order by t.business_date desc, 2;
end $$;

revoke all on function public.report_payments(uuid, date, date) from public, anon;
grant execute on function public.report_payments(uuid, date, date) to authenticated;

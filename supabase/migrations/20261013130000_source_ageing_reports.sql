-- Two finance reports (RPT-005, RPT-006).
-- 1. Revenue by booking source: which channels bring bookings, nights and room money.
-- 2. Ageing of unpaid balances by booking source: how long guests and companies have owed the hotel.
-- Both need rpt.finance.view. Figures come from the ledger and the booked nights, never from the browser.

create or replace function public.report_revenue_by_source(p_property_id uuid, p_from date, p_to date)
returns table(source text, bookings bigint, cancelled bigint, no_shows bigint, room_nights bigint, room_revenue numeric, adr numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform app.require_report('rpt.finance.view', p_property_id);
  if p_from is null or p_to is null or p_to < p_from then
    perform app.fail('E_INVALID', 'The end date cannot be before the start date.');
  end if;
  return query
  with res as (
    select r.source,
      count(*) filter (where r.status not in ('cancelled', 'no_show')) as bookings,
      count(*) filter (where r.status = 'cancelled') as cancelled,
      count(*) filter (where r.status = 'no_show') as no_shows
    from public.reservations r
    where r.property_id = p_property_id and r.arrival_date between p_from and p_to
    group by r.source
  ), nights as (
    select r.source, count(*) as room_nights
    from public.reservation_nights n join public.reservations r on r.id = n.reservation_id
    where r.property_id = p_property_id and n.stay_date between p_from and p_to and r.status not in ('cancelled', 'no_show')
    group by r.source
  ), rev as (
    select r.source, sum(t.base_amount)::numeric as room_revenue
    from public.folio_transactions t
    join public.folios f on f.id = t.folio_id
    join public.reservations r on r.id = f.reservation_id
    join public.charge_codes c on c.id = t.charge_code_id
    where t.property_id = p_property_id and c.category = 'room' and t.kind not in ('payment', 'refund')
      and t.business_date between p_from and p_to
    group by r.source
  ), keys as (
    select res.source from res union select nights.source from nights union select rev.source from rev
  )
  select k.source, coalesce(res.bookings, 0), coalesce(res.cancelled, 0), coalesce(res.no_shows, 0),
    coalesce(nights.room_nights, 0), coalesce(rev.room_revenue, 0)::numeric,
    round(coalesce(rev.room_revenue, 0) / nullif(nights.room_nights, 0), 2)
  from keys k
  left join res on res.source = k.source
  left join nights on nights.source = k.source
  left join rev on rev.source = k.source
  order by 6 desc, 1;
end $$;

-- Unpaid balances by source and age. Age counts the days since the guest was due to leave.
-- Guests still staying, or due to arrive, are "current". Credits (overpayments) are shown apart.
create or replace function public.report_balance_ageing(p_property_id uuid)
returns table(source text, currency char(3), folios bigint, current_amount numeric, days_1_7 numeric, days_8_30 numeric,
  days_31_60 numeric, days_61_plus numeric, total numeric, credit_held numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_today date;
begin
  perform app.require_report('rpt.finance.view', p_property_id);
  select business_date into v_today from public.properties where id = p_property_id;
  return query
  select r.source, b.currency,
    count(*) filter (where b.balance > 0),
    coalesce(sum(b.balance) filter (where b.balance > 0 and v_today - b.departure_date <= 0), 0)::numeric,
    coalesce(sum(b.balance) filter (where b.balance > 0 and v_today - b.departure_date between 1 and 7), 0)::numeric,
    coalesce(sum(b.balance) filter (where b.balance > 0 and v_today - b.departure_date between 8 and 30), 0)::numeric,
    coalesce(sum(b.balance) filter (where b.balance > 0 and v_today - b.departure_date between 31 and 60), 0)::numeric,
    coalesce(sum(b.balance) filter (where b.balance > 0 and v_today - b.departure_date > 60), 0)::numeric,
    coalesce(sum(b.balance) filter (where b.balance > 0), 0)::numeric,
    coalesce(-sum(b.balance) filter (where b.balance < 0), 0)::numeric
  from public.v_folio_balances b
  join public.reservations r on r.id = b.reservation_id
  where b.property_id = p_property_id and b.balance <> 0
  group by r.source, b.currency
  order by 9 desc, 1;
end $$;

revoke all on function public.report_revenue_by_source(uuid, date, date) from public, anon;
revoke all on function public.report_balance_ageing(uuid) from public, anon;
grant execute on function public.report_revenue_by_source(uuid, date, date) to authenticated;
grant execute on function public.report_balance_ageing(uuid) to authenticated;

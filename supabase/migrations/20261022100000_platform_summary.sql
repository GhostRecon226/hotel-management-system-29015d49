-- Platform summary (PLT-024): the owner's one-glance view on the platform console.
-- One read-only function for platform operators (operator list AND two-step sign-in, checked by app.require_platform).
-- It returns hotel account data only: counts, hotel names, dates and the list price of each paying hotel's plan.
-- No guests, bookings, balances or contact details (PLT-009). The money figure is worked out here, in whole currency.
create or replace function public.platform_summary()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_result jsonb;
begin
  perform app.require_platform();

  with hotels as (
    select t.id as tenant_id, t.name as hotel_name, t.country, t.created_at, s.status, s.plan_code, s.trial_ends_at,
           coalesce((select p.base_currency from public.properties p where p.tenant_id = t.id order by p.created_at, p.id limit 1), 'NGN')::text as currency
    from public.tenants t
    join public.tenant_subscriptions s on s.tenant_id = t.id
    join public.plans pl on pl.code = s.plan_code
  ), signins as (
    select h.tenant_id, max(u.last_sign_in_at) as last_sign_in_at
    from hotels h
    left join public.profiles pr on pr.tenant_id = h.tenant_id and pr.status = 'active'
    left join auth.users u on u.id = pr.id
    group by h.tenant_id
  )
  select jsonb_build_object(
    'generated_at', now(),
    'hotels', (select count(*)::int from hotels),
    'by_status', (select coalesce(jsonb_object_agg(x.status, x.n), '{}'::jsonb)
                  from (select status, count(*)::int as n from hotels group by status) x),
    'joined_7d', (select count(*)::int from hotels where created_at >= now() - interval '7 days'),
    'joined_30d', (select count(*)::int from hotels where created_at >= now() - interval '30 days'),
    'joined_prev_7d', (select count(*)::int from hotels where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days'),
    -- Change on the week before, in whole percent. Null when the week before had no new hotel (nothing to compare with).
    'joined_change_pct', (select case when p.prev = 0 then null else round((p.cur - p.prev) * 100.0 / p.prev)::int end
                          from (select count(*) filter (where created_at >= now() - interval '7 days') as cur,
                                       count(*) filter (where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days') as prev
                                from hotels) p),
    -- New hotels in each of the last 8 weeks, oldest first, for the small trend line.
    'joined_weekly', (select coalesce(jsonb_agg(w.n order by w.k desc), '[]'::jsonb)
                      from (select g.k, (select count(*)::int from hotels h
                                         where h.created_at >= now() - ((g.k + 1) * interval '7 days')
                                           and h.created_at < now() - (g.k * interval '7 days')) as n
                            from generate_series(0, 7) g(k)) w),
    'trials_ending', (select coalesce(jsonb_agg(jsonb_build_object(
                        'tenant_id', x.tenant_id, 'hotel_name', x.hotel_name, 'country', x.country, 'trial_ends_at', x.trial_ends_at,
                        'days', greatest(0, ceil(extract(epoch from (x.trial_ends_at - now())) / 86400))::int
                      ) order by x.trial_ends_at), '[]'::jsonb)
                      from (select tenant_id, hotel_name, country, trial_ends_at from hotels
                            where status = 'trial' and trial_ends_at is not null and trial_ends_at <= now() + interval '14 days'
                            order by trial_ends_at limit 20) x),
    'quiet', (select coalesce(jsonb_agg(jsonb_build_object(
                'tenant_id', x.tenant_id, 'hotel_name', x.hotel_name, 'country', x.country, 'last_sign_in_at', x.last_sign_in_at,
                'days_inactive', case when x.last_sign_in_at is null then null else floor(extract(epoch from (now() - x.last_sign_in_at)) / 86400)::int end
              ) order by x.last_sign_in_at nulls first, x.hotel_name), '[]'::jsonb)
              from (select h.tenant_id, h.hotel_name, h.country, s.last_sign_in_at
                    from hotels h join signins s on s.tenant_id = h.tenant_id
                    where h.status in ('trial', 'active', 'past_due')
                      and h.created_at < now() - interval '7 days'
                      and (s.last_sign_in_at is null or s.last_sign_in_at < now() - interval '7 days')
                    order by s.last_sign_in_at nulls first, h.hotel_name limit 20) x),
    'monthly_value', (select coalesce(jsonb_agg(jsonb_build_object('currency', y.currency, 'amount', y.amount, 'hotels', y.n)
                        order by y.currency), '[]'::jsonb)
                      from (select h.currency, count(*)::int as n,
                                   round(sum((pl.prices -> h.currency ->> 'month')::numeric) / power(10::numeric, app.currency_decimals(h.currency)::numeric),
                                         app.currency_decimals(h.currency)) as amount
                            from hotels h join public.plans pl on pl.code = h.plan_code
                            where h.status = 'active' and (pl.prices -> h.currency ->> 'month') is not null
                            group by h.currency) y)
  ) into v_result;

  return v_result;
end $$;

revoke all on function public.platform_summary() from public, anon;
grant execute on function public.platform_summary() to authenticated;

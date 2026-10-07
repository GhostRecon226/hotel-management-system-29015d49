-- The failed-payment queue shows whole currency (not kobo), so the console does no money arithmetic (PLT-012).
-- Replaces the version of 20261013100000 (column amount_minor becomes amount). Nothing else changes.
drop function public.platform_failed_payments();

create function public.platform_failed_payments()
returns table (payment_id uuid, created_at timestamptz, tenant_id uuid, tenant_name text, plan_code text,
  period text, amount numeric, currency text, status text, reference text, failure_reason text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform app.require_platform();
  return query
  select p.id, p.created_at, p.tenant_id, t.name, p.plan_code, p.interval, round(p.amount_minor::numeric / 100, 2), p.currency::text,
         p.status, p.reference, p.failure_reason
  from public.subscription_payments p join public.tenants t on t.id = p.tenant_id
  where (p.status = 'failed' and p.created_at > now() - interval '60 days')
     or (p.status = 'pending' and p.created_at < now() - interval '1 day')
  order by p.created_at desc;
end $$;

revoke all on function public.platform_failed_payments() from public, anon, authenticated;
grant execute on function public.platform_failed_payments() to authenticated;

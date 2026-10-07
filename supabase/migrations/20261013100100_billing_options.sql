-- Billing screen figures (PLT-012). The browser never works out money: Postgres turns kobo into whole naira
-- and says which plans the hotel can buy. Also returns the hotel's own payments.
create or replace function public.billing_options()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_tenant uuid := app.my_tenant(); v_cur text; v_rooms int; v_props int; v_users int;
begin
  if v_tenant is null or not app.can('adm.subscription.manage', null) then
    perform app.fail('E_FORBIDDEN', 'You cannot change the subscription.'); end if;
  select base_currency into v_cur from public.properties where tenant_id = v_tenant order by created_at, id limit 1;
  select count(*) into v_rooms from public.rooms where tenant_id = v_tenant and is_active;
  select count(*) into v_props from public.properties where tenant_id = v_tenant;
  select count(*) into v_users from public.profiles where tenant_id = v_tenant and status = 'active';
  return jsonb_build_object(
    'currency', v_cur,
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', p.code, 'name', p.name,
        'max_rooms', p.max_rooms, 'max_properties', p.max_properties, 'max_users', p.max_users,
        'month', round(((p.prices -> v_cur ->> 'month')::numeric) / 100, 2),
        'year', round(((p.prices -> v_cur ->> 'year')::numeric) / 100, 2),
        'fits', f.fits,
        'can_buy', f.fits and coalesce((p.prices -> v_cur) ? 'month', false) or f.fits and coalesce((p.prices -> v_cur) ? 'year', false))
        order by p.max_rooms nulls last)
      from public.plans p
      cross join lateral (select not ((p.max_rooms is not null and v_rooms > p.max_rooms)
                                   or (p.max_properties is not null and v_props > p.max_properties)
                                   or (p.max_users is not null and v_users > p.max_users)) as fits) f), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'created_at', s.created_at, 'plan_code', s.plan_code, 'period', s.interval,
        'amount', round(s.amount_minor::numeric / 100, 2), 'currency', s.currency,
        'status', s.status, 'failure_reason', s.failure_reason, 'paid_at', s.paid_at)
        order by s.created_at desc)
      from (select * from public.subscription_payments where tenant_id = v_tenant order by created_at desc limit 20) s), '[]'::jsonb));
end $$;

revoke all on function public.billing_options() from public, anon;
grant execute on function public.billing_options() to authenticated;

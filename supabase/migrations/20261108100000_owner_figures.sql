-- RPT-010: the owner's "Yesterday" figures in one read-only call.
-- Last closed day: revenue, occupancy, ADR, RevPAR, money collected; what guests owe now; and the change against the
-- same weekday one week earlier. The browser never does money arithmetic, so the change is worked out here.
-- Needs rpt.finance.view. Changes no data.

create or replace function public.owner_figures(p_property_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  p public.properties; v_day date; v_prev date; d public.daily_stats; q public.daily_stats;
  v_coll numeric; v_coll_prev numeric; v_owed numeric; v_folios bigint;
  d_occ numeric; d_adr numeric; d_rev numeric; q_occ numeric; q_adr numeric; q_rev numeric;
begin
  perform app.require_report('rpt.finance.view', p_property_id);
  select * into p from public.properties where id = p_property_id and tenant_id = app.my_tenant();
  v_day := p.business_date - 1;
  v_prev := v_day - 7;
  select * into d from public.daily_stats where property_id = p.id and business_date = v_day;
  select * into q from public.daily_stats where property_id = p.id and business_date = v_prev;

  d_occ := round(d.rooms_sold::numeric / nullif(d.rooms_available, 0), 4);
  d_adr := round(d.room_revenue / nullif(d.rooms_sold, 0), 2);
  d_rev := round(d.room_revenue / nullif(d.rooms_available, 0), 2);
  q_occ := round(q.rooms_sold::numeric / nullif(q.rooms_available, 0), 4);
  q_adr := round(q.room_revenue / nullif(q.rooms_sold, 0), 2);
  q_rev := round(q.room_revenue / nullif(q.rooms_available, 0), 2);

  select coalesce(-sum(t.base_amount) filter (where t.business_date = v_day), 0)::numeric,
         coalesce(-sum(t.base_amount) filter (where t.business_date = v_prev), 0)::numeric
    into v_coll, v_coll_prev
  from public.folio_transactions t
  where t.property_id = p.id and t.business_date in (v_day, v_prev) and app.is_money_movement(t.kind, t.payment_method_id);

  select coalesce(sum(b.balance), 0)::numeric, count(*)
    into v_owed, v_folios
  from public.v_folio_balances b
  where b.property_id = p.id and b.balance > 0 and b.currency::text = p.base_currency::text;

  return jsonb_build_object(
    'date', v_day, 'compare_date', v_prev, 'currency', p.base_currency::text,
    'has_figures', d.id is not null,
    'revenue', d.total_revenue, 'occupancy', d_occ, 'adr', d_adr, 'revpar', d_rev,
    'collected', v_coll, 'owed', v_owed, 'owed_folios', v_folios,
    'change', jsonb_build_object(
      'revenue_pct', round((d.total_revenue - q.total_revenue) / nullif(q.total_revenue, 0) * 100, 1),
      'occupancy_points', round((d_occ - q_occ) * 100, 1),
      'adr', d_adr - q_adr,
      'revpar', d_rev - q_rev,
      'collected_pct', case when q.id is null then null else round((v_coll - v_coll_prev) / nullif(v_coll_prev, 0) * 100, 1) end));
end $$;

revoke all on function public.owner_figures(uuid) from public, anon;
grant execute on function public.owner_figures(uuid) to authenticated;

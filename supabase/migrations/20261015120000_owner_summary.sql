-- RPT-007: the owner summary. The same facts as the morning brief, plus the money collected on the last closed day,
-- with the sentences built in the database. It works with AI switched off. A later daily email can send the same text.
-- Read only. Needs both finance and operations report rights, like the morning brief.

create or replace function public.owner_summary(p_property_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare p public.properties; v_facts jsonb; v_date date; v_total numeric; v_methods jsonb; v_line text; v_lines jsonb; v_cur text;
begin
  perform app.require_report('rpt.finance.view', p_property_id);
  perform app.require_report('rpt.operations.view', p_property_id);
  select * into p from public.properties where id = p_property_id and tenant_id = app.my_tenant();
  v_cur := p.base_currency::text;
  v_date := p.business_date - 1;
  v_facts := app.morning_brief_facts(p);

  select coalesce(-sum(t.base_amount), 0)::numeric into v_total
  from public.folio_transactions t
  where t.property_id = p.id and t.business_date = v_date and t.kind in ('payment', 'refund');

  select coalesce(jsonb_agg(jsonb_build_object('method', x.method, 'amount', x.amount) order by x.amount desc, x.method), '[]'::jsonb) into v_methods
  from (select coalesce(m.name, 'Other') as method, (-sum(t.base_amount))::numeric as amount
        from public.folio_transactions t left join public.payment_methods m on m.id = t.payment_method_id
        where t.property_id = p.id and t.business_date = v_date and t.kind in ('payment', 'refund')
        group by m.name having -sum(t.base_amount) <> 0) x;

  v_line := format('Collected on %s: %s %s%s.', to_char(v_date, 'DD Mon YYYY'), v_cur, to_char(v_total, 'FM999,999,999,990.00'),
    coalesce((select ' (' || string_agg(m->>'method' || ' ' || to_char((m->>'amount')::numeric, 'FM999,999,999,990.00'), ', ') || ')'
              from jsonb_array_elements(v_methods) m), ''));

  -- Put the collected line after last night's line (second sentence) so the order reads: date, last night, collected, today ...
  select jsonb_agg(l order by o) into v_lines from (
    select l, o from jsonb_array_elements_text(v_facts->'lines') with ordinality as t(l, o) where o <= 2
    union all select v_line, 2.5
    union all select l, o from jsonb_array_elements_text(v_facts->'lines') with ordinality as t(l, o) where o > 2) z;

  return (v_facts - 'lines') || jsonb_build_object(
    'collected', jsonb_build_object('date', v_date, 'total', v_total, 'by_method', v_methods),
    'lines', v_lines,
    'text', (select string_agg(l, E'\n' order by o) from jsonb_array_elements_text(v_lines) with ordinality as t(l, o)));
end $$;

revoke all on function public.owner_summary(uuid) from public, anon;
grant execute on function public.owner_summary(uuid) to authenticated;

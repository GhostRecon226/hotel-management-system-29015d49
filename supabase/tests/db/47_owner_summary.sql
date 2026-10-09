-- [RPT-007] The owner summary: last night's figures, money collected, today's position and what needs attention, without AI.
begin;

do $$
declare v_r uuid; v_f uuid; v_tx uuid; j jsonb; v_text text;
begin
  perform t.login('adminA');
  perform public.save_room(t.id('propA'), null, '195', t.id('std'), '1', true);
  perform t.admin();
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('195'), null, null);
  v_f := t.main_folio(v_r);
  perform public.post_payment(v_f, t.pm('CASH'), 5000, 'NGN', false, null, null, 'own-pay-1');
  perform public.post_payment(v_f, t.pm('CASH'), 2500, 'NGN', false, null, 'second', 'own-pay-2');
  -- A payment taken and reversed the same day nets to zero.
  v_tx := public.post_payment(v_f, t.pm('CARD'), 1000, 'NGN', false, null, 'CARD-1', 'own-pay-3');
  perform t.login('fom');
  j := public.request_reversal(v_tx, 'Card machine error', 'own-rev-req');
  perform t.login('acc');
  perform public.decide_approval((j->>'approval_id')::uuid, true, 'ok');
  perform t.login('fdo');
  perform t.raises(format('select public.owner_summary(%L)', t.id('propA')), 'E_FORBIDDEN', '[RPT-007] front desk without finance reports cannot read the owner summary');
  perform t.admin();

  -- Payments were posted on the current business date. Move the date on one day so they fall in "last night".
  perform t.set_bdate(t.id('propA'), t.bdate() + 1);
  perform t.login('acc');
  j := public.owner_summary(t.id('propA'));
  perform t.admin();
  perform t.eq((j->'collected'->>'date')::date, t.bdate() - 1, '[RPT-007] the money collected is for the last closed day');
  perform t.eq((j->'collected'->>'total')::numeric, 7500.00, '[RPT-007] collected total is the sum of the day''s payments (5,000 + 2,500)');
  perform t.eq((select (m->>'amount')::numeric from jsonb_array_elements(j->'collected'->'by_method') m where m->>'method' = 'Cash'), 7500.00, '[RPT-007] collected is split by payment method');
  perform t.ok(not exists (select 1 from jsonb_array_elements(j->'collected'->'by_method') m where m->>'method' = 'Card'), '[RPT-007] a payment reversed the same day does not count as collected');
  perform t.ok(jsonb_array_length(j->'lines') >= 6, '[RPT-007] the summary has its sentences, built in the database');
  v_text := j->>'text';
  perform t.ok(v_text like '%Collected%7,500.00%', '[RPT-007] the plain text says how much was collected');
  perform t.ok(v_text like '%approvals%', '[RPT-007] the plain text says what is waiting');
  perform t.ok(j ? 'attention' and j ? 'today', '[RPT-007] today''s position and the attention counts are included');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('owner summary', sqlerrm);
end $$;

rollback;

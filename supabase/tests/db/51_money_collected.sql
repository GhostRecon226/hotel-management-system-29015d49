-- [RPT-009] One rule for money collected: payments, refunds, and reversals or transfers that carry a payment method.
-- The Payments report, the owner summary and the invoice must agree.
begin;

do $$
declare v_r uuid; v_f uuid; v_tx uuid; j jsonb; v_rep numeric; v_own numeric;
begin
  perform t.login('adminA');
  perform public.save_room(t.id('propA'), null, '196', t.id('std'), '1', true);
  perform t.admin();
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('196'), null, null);
  v_f := t.main_folio(v_r);
  perform public.post_payment(v_f, t.pm('CASH'), 5000, 'NGN', false, null, null, 'mc-pay-1');
  v_tx := public.post_payment(v_f, t.pm('CARD'), 1000, 'NGN', false, null, 'CARD-9', 'mc-pay-2');
  perform t.login('fom');
  j := public.request_reversal(v_tx, 'Card machine error', 'mc-rev-req');
  perform t.login('acc');
  perform public.decide_approval((j->>'approval_id')::uuid, true, 'ok');

  -- Payments report: a payment reversed the same day nets to zero, like the owner summary.
  perform t.eq((select coalesce(sum(net), 0) from public.report_payments(t.id('propA'), t.bdate(), t.bdate())),
    (select -sum(x.base_amount) from public.folio_transactions x where x.property_id = t.id('propA') and x.business_date = t.bdate()
       and x.payment_method_id is not null and x.folio_id = v_f),
    '[RPT-009] the Payments report counts a reversed payment as taken back');
  perform t.eq((select coalesce(sum(net), 0) from public.report_payments(t.id('propA'), t.bdate(), t.bdate()) where method = 'Card'), 0::numeric,
    '[RPT-009] a card payment reversed the same day shows net 0 on the Payments report');
  perform t.eq((select coalesce(sum(net), 0) from public.report_payments(t.id('propA'), t.bdate(), t.bdate()) where method = 'Cash'),
    (select coalesce(-sum(x.base_amount), 0) from public.folio_transactions x where x.property_id = t.id('propA') and x.business_date = t.bdate()
       and x.payment_method_id = t.pm('CASH')),
    '[RPT-009] cash on the report matches the ledger');
  perform t.login('fdo');
  perform t.raises(format('select * from public.report_payments(%L, %L, %L)', t.id('propA'), t.bdate(), t.bdate()), 'E_FORBIDDEN',
    '[RPT-009] front desk without finance reports cannot read the Payments report');
  perform t.admin();
  perform t.anon();
  perform t.raises(format('select * from public.report_payments(%L, %L, %L)', t.id('propA'), t.bdate(), t.bdate()), 'permission denied',
    '[RPT-009] signed-out users cannot call the Payments report');
  perform t.admin();
end $$;

rollback;

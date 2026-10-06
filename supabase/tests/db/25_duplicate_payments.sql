-- Duplicate payment guard (FIN-017, wave 1, 6 Oct 2026). A payment on the same bill with the same amount, currency,
-- method and reference as one recorded in the last 10 minutes is refused unless the cashier confirms it with a
-- reason. The refusal names the earlier payment; the confirmation is audited. A retry with the same key is not a
-- duplicate (it returns the first payment), and an earlier payment that was reversed no longer counts.
begin;

create function t.dup_audits(p_tx uuid) returns integer language sql stable security definer as $$
  select count(*)::int from public.audit_events where action = 'payment_duplicate_confirmed' and record_id = p_tx::text
$$;
grant execute on function t.dup_audits(uuid) to authenticated;

do $$
declare v_res uuid; v_f uuid; v_p1 uuid; v_p2 uuid; v_msg text; a public.audit_events;
begin
  perform t.login('fdo');
  v_res := t.book(t.id('g2'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  perform public.check_in(v_res, t.reg(), t.room('102'), null, null);
  v_f := t.main_folio(v_res);
  perform t.put('dupf', v_f);

  v_p1 := public.post_payment(v_f, t.pm('CASH'), 50000, 'NGN', false, null, 'RCPT-1', 'dup-1');
  perform t.ok(v_p1 is not null, '[FIN-017] the first payment is recorded');
  perform t.eq(public.post_payment(v_f, t.pm('CASH'), 50000, 'NGN', false, null, 'RCPT-1', 'dup-1'), v_p1,
    '[FIN-017] a retry with the same key returns the first payment and is not treated as a duplicate');

  perform t.raises(format('select public.post_payment(%L, %L, 50000, %L, false, null, %L, %L)', v_f, t.pm('CASH'), 'NGN', 'RCPT-1', 'dup-2'),
    'E_POSSIBLE_DUPLICATE', '[FIN-017] the same bill, amount, method and reference within 10 minutes is refused');
  begin
    perform public.post_payment(v_f, t.pm('CASH'), 50000, 'NGN', false, null, 'RCPT-1', 'dup-2');
  exception when others then v_msg := sqlerrm;
  end;
  perform t.ok(v_msg ~ '50,000\.00' and v_msg ~ 'Cash' and v_msg ~ 'RCPT-1', '[FIN-017] the refusal names the earlier payment (amount, method, reference)');
  perform t.ok(position('confirm' in lower(v_msg)) > 0, '[FIN-017] and tells the cashier how to confirm');
  perform t.eq((select count(*)::int from public.folio_transactions where folio_id = v_f and kind = 'payment'), 1, '[FIN-017] nothing was recorded by the refused attempt');

  perform t.raises(format('select public.post_payment(%L, %L, 50000, %L, false, null, %L, %L, %L)', v_f, t.pm('CASH'), 'NGN', 'RCPT-1', 'dup-3', '   '),
    'E_POSSIBLE_DUPLICATE', '[FIN-017] a blank reason does not confirm');

  perform t.lives(format('select public.post_payment(%L, %L, 50000, %L, false, null, %L, %L)', v_f, t.pm('CASH'), 'NGN', 'RCPT-2', 'dup-4'),
    '[FIN-017] a different reference is not a duplicate');
  perform t.lives(format('select public.post_payment(%L, %L, 20000, %L, false, null, %L, %L)', v_f, t.pm('CASH'), 'NGN', 'RCPT-1', 'dup-5'),
    '[FIN-017] a different amount is not a duplicate');
  perform t.lives(format('select public.post_payment(%L, %L, 50000, %L, false, null, %L, %L)', v_f, t.pm('POS'), 'NGN', 'RCPT-1', 'dup-6'),
    '[FIN-017] a different method is not a duplicate');

  v_p2 := public.post_payment(v_f, t.pm('CASH'), 50000, 'NGN', false, null, 'RCPT-1', 'dup-7', 'Guest paid the deposit and the balance separately');
  perform t.ok(v_p2 is not null and v_p2 <> v_p1, '[FIN-017] with a reason, the second payment is recorded');
  perform t.admin();
  select * into a from public.audit_events where action = 'payment_duplicate_confirmed' and record_id = v_p2::text;
  perform t.eq(a.reason, 'Guest paid the deposit and the balance separately', '[FIN-017] the confirmation and its reason are audited');
  perform t.eq(a.after->>'earlier_transaction_id', v_p1::text, '[FIN-017] the audit row names the earlier payment');
  perform t.eq(a.actor_id, t.id('fdo'), '[FIN-017] and who confirmed it');
  perform t.eq(t.dup_audits(v_p1), 0, '[FIN-017] an ordinary payment writes no confirmation row');
end $$;

-- Two payments a few minutes apart without a reference are still compared (same bill, amount, method, no reference).
do $$
declare v_f uuid := t.id('dupf');
begin
  perform t.login('fdo');
  perform public.post_payment(v_f, t.pm('TRANSFER'), 7500, 'NGN', false, null, null, 'dup-nr-1');
  perform t.raises(format('select public.post_payment(%L, %L, 7500, %L, false, null, null, %L)', v_f, t.pm('TRANSFER'), 'NGN', 'dup-nr-2'),
    'E_POSSIBLE_DUPLICATE', '[FIN-017] two payments with no reference are compared too');
end $$;

-- Another bill is never compared.
do $$
declare v_res uuid; v_f uuid;
begin
  perform t.login('fdo');
  v_res := t.book(t.id('g3'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform public.check_in(v_res, t.reg(), t.room('103'), null, null);
  v_f := t.main_folio(v_res);
  perform t.lives(format('select public.post_payment(%L, %L, 50000, %L, false, null, %L, %L)', v_f, t.pm('CASH'), 'NGN', 'RCPT-1', 'dup-other'),
    '[FIN-017] the same payment on another bill is not a duplicate');
end $$;

-- A reversed earlier payment no longer counts.
do $$
declare v_f uuid := t.id('dupf'); v_tx uuid; j jsonb;
begin
  perform t.login('fdo');
  v_tx := public.post_payment(v_f, t.pm('CARD'), 12000, 'NGN', false, null, 'CARD-9', 'dup-rev-1');
  perform t.login('fom');
  j := public.request_reversal(v_tx, 'Card machine error', 'dup-rev-req');
  perform t.login('acc');
  perform public.decide_approval((j->>'approval_id')::uuid, true, 'ok');
  perform t.login('fdo');
  perform t.lives(format('select public.post_payment(%L, %L, 12000, %L, false, null, %L, %L)', v_f, t.pm('CARD'), 'NGN', 'CARD-9', 'dup-rev-2'),
    '[FIN-017] after the earlier payment is reversed, entering it again is not a duplicate');
end $$;

-- The window is one setting (10 minutes). Set to 0, nothing is compared.
do $$
declare v_f uuid := t.id('dupf');
begin
  perform t.admin();
  perform t.eq((select value from app.settings where key = 'duplicate_payment_window_minutes'), '10', '[FIN-017] the window is 10 minutes, in one setting');
  update app.settings set value = '0' where key = 'duplicate_payment_window_minutes';
  perform t.login('fdo');
  perform t.lives(format('select public.post_payment(%L, %L, 50000, %L, false, null, %L, %L)', v_f, t.pm('CASH'), 'NGN', 'RCPT-1', 'dup-w0'),
    '[FIN-017] with the window at 0 minutes, no payment is refused');
  perform t.admin();
  update app.settings set value = '10' where key = 'duplicate_payment_window_minutes';
end $$;

rollback;

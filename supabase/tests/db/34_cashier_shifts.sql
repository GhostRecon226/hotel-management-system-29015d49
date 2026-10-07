-- Cashier shifts and night audit flags (FIN-016, DAY-005). A cashier opens a shift with a float, takes payments,
-- counts the drawer at the end, and the database says what the drawer should hold, per payment method.
-- A manager then reconciles the shift. Before the night audit, the flags list what is still open.
begin;

do $$
declare v_s uuid; v_s2 uuid;
begin
  perform t.admin();
  perform t.login('hks');
  perform t.raises(format($q$select public.open_cashier_shift(%L, 5000, 'sh-hks')$q$, t.id('propA')), 'E_FORBIDDEN', '[FIN-016] staff without cashier rights cannot open a shift');
  perform t.anon();
  perform t.raises(format($q$select public.open_cashier_shift(%L, 5000, 'sh-anon')$q$, t.id('propA')), 'permission denied', '[FIN-016] nor a signed-out visitor');
  perform t.login('csh');
  perform t.raises(format($q$select public.open_cashier_shift(%L, -1, 'sh-neg')$q$, t.id('propA')), 'E_INVALID', '[FIN-016] the opening float cannot be negative');
  perform t.raises(format($q$select public.open_cashier_shift(%L, 5000, '')$q$, t.id('propA')), 'E_REQUIRED', '[FIN-016] a shift needs an idempotency key');
  v_s := public.open_cashier_shift(t.id('propA'), 5000, 'sh-1');
  perform t.put('shift1', v_s);
  perform t.ok(v_s is not null, '[FIN-016] a cashier opens a shift with a float');
  perform t.eq(public.open_cashier_shift(t.id('propA'), 5000, 'sh-1'), v_s, '[FIN-016] a retry with the same key returns the same shift');
  perform t.raises(format($q$select public.open_cashier_shift(%L, 0, 'sh-2')$q$, t.id('propA')), 'E_SHIFT_OPEN', '[FIN-016] one open shift per cashier and hotel');
  perform t.admin();
  perform t.eq((select status from public.cashier_shifts where id = v_s), 'open', '[FIN-016] the shift is open');
  perform t.eq((select business_date from public.cashier_shifts where id = v_s), t.bdate(), '[FIN-016] and carries the hotel''s business date');
end $$;

-- Payments are tied to the poster's open shift. Someone with no shift is not in anyone's drawer.
do $$
declare v_res uuid; v_f uuid; j jsonb; v_cash jsonb; v_pos jsonb;
begin
  perform t.login('fdo');
  v_res := t.book(t.id('g2'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  perform public.check_in(v_res, t.reg(), t.room('103'), null, null);
  v_f := t.main_folio(v_res);
  perform t.put('shiftf', v_f);
  perform public.post_payment(v_f, t.pm('CASH'), 10000, 'NGN', false, null, 'FDO-1', 'sh-pay-fdo');
  perform t.login('csh');
  perform public.post_payment(v_f, t.pm('CASH'), 50000, 'NGN', false, null, 'CSH-1', 'sh-pay-1');
  perform public.post_payment(v_f, t.pm('POS'), 20000, 'NGN', false, null, 'CSH-2', 'sh-pay-2');
  j := public.cashier_shift_summary(t.id('shift1'));
  select x into v_cash from jsonb_array_elements(j->'lines') x where x->>'payment_method_id' = t.pm('CASH')::text;
  select x into v_pos from jsonb_array_elements(j->'lines') x where x->>'payment_method_id' = t.pm('POS')::text;
  perform t.eq((v_cash->>'expected')::numeric, 55000.00, '[FIN-016] cash expected is the float plus the cash this cashier took');
  perform t.eq((v_pos->>'expected')::numeric, 20000.00, '[FIN-016] POS expected is what was taken on POS');
  perform t.eq(j->>'status', 'open', '[FIN-016] the summary says the shift is open');
  perform t.login('fdo');
  perform t.raises(format($q$select public.cashier_shift_summary(%L)$q$, t.id('shift1')), 'E_FORBIDDEN', '[FIN-016] another cashier cannot read this shift');
  perform t.admin();
end $$;

-- Closing: count every method that took money; a difference needs a note.
do $$
declare j jsonb; v_msg text;
begin
  perform t.login('csh');
  perform t.raises(format($q$select public.close_cashier_shift(%L, %L::jsonb, null)$q$, t.id('shift1'),
    jsonb_build_array(jsonb_build_object('payment_method_id', t.pm('CASH'), 'counted', 55000))::text),
    'E_INVALID', '[FIN-016] every method that took money must be counted');
  perform t.raises(format($q$select public.close_cashier_shift(%L, %L::jsonb, null)$q$, t.id('shift1'),
    jsonb_build_array(jsonb_build_object('payment_method_id', t.pm('CASH'), 'counted', -5),
                      jsonb_build_object('payment_method_id', t.pm('POS'), 'counted', 20000))::text),
    'E_INVALID', '[FIN-016] a count cannot be negative');
  perform t.raises(format($q$select public.close_cashier_shift(%L, %L::jsonb, null)$q$, t.id('shift1'),
    jsonb_build_array(jsonb_build_object('payment_method_id', t.pm('CASH'), 'counted', 54000),
                      jsonb_build_object('payment_method_id', t.pm('POS'), 'counted', 20000))::text),
    'E_REQUIRED', '[FIN-016] a difference needs a note');
  j := public.close_cashier_shift(t.id('shift1'), jsonb_build_array(
    jsonb_build_object('payment_method_id', t.pm('CASH'), 'counted', 54000),
    jsonb_build_object('payment_method_id', t.pm('POS'), 'counted', 20000)), 'Gave change from the drawer, 1,000 short');
  perform t.eq(j->>'status', 'closed', '[FIN-016] the shift closes');
  perform t.eq((select (x->>'variance')::numeric from jsonb_array_elements(j->'lines') x where x->>'payment_method_id' = t.pm('CASH')::text), -1000.00, '[FIN-016] the database works out the difference: counted minus expected');
  perform t.eq((select (x->>'variance')::numeric from jsonb_array_elements(j->'lines') x where x->>'payment_method_id' = t.pm('POS')::text), 0.00, '[FIN-016] and zero where it matches');
  perform t.eq((j->>'variance_total')::numeric, -1000.00, '[FIN-016] with a total');
  perform t.raises(format($q$select public.close_cashier_shift(%L, '[]'::jsonb, null)$q$, t.id('shift1')), 'E_INVALID', '[FIN-016] a closed shift cannot be closed again');
  -- A payment after closing belongs to no shift.
  perform public.post_payment(t.id('shiftf'), t.pm('CASH'), 1000, 'NGN', false, null, 'CSH-3', 'sh-pay-3');
  perform t.eq((select (x->>'expected')::numeric from jsonb_array_elements(public.cashier_shift_summary(t.id('shift1'))->'lines') x where x->>'payment_method_id' = t.pm('CASH')::text), 55000.00, '[FIN-016] a closed shift''s figures do not move');
  perform t.admin();
  perform t.eq((select count(*)::int from public.cashier_shift_lines where shift_id = t.id('shift1')), 2, '[FIN-016] one line per method is kept');
  perform t.login('csh');
  perform t.raises(format($q$update public.cashier_shift_lines set counted = 55000 where shift_id = %L$q$, t.id('shift1')), 'permission denied', '[FIN-016] a cashier cannot edit the count afterwards');
  perform t.admin();
end $$;

-- Managers see all shifts and reconcile them. The closer cannot reconcile their own shift.
do $$
declare v_s uuid; j jsonb;
begin
  perform t.login('gm');
  j := public.list_cashier_shifts(t.id('propA'), null, null, null);
  perform t.ok(jsonb_array_length(j) >= 1, '[FIN-016] a manager sees the hotel''s shifts');
  perform t.ok((j->0->>'cashier_name') is not null and (j->0->>'variance_total') is not null, '[FIN-016] with the cashier and the total difference');
  perform t.login('csh');
  perform t.eq(jsonb_array_length(public.list_cashier_shifts(t.id('propA'), null, null, null)), 1, '[FIN-016] a cashier sees only their own shifts');
  perform t.raises(format($q$select public.reconcile_cashier_shift(%L, 'ok')$q$, t.id('shift1')), 'E_FORBIDDEN', '[FIN-016] a cashier cannot reconcile');
  perform t.admin();
  -- The fixture copies the built-in role after this migration, so take the permission off it, as an older copy would lack it.
  delete from public.role_permissions where permission_key = 'fin.shift.reconcile'
    and role_id in (select role_id from public.user_property_roles where user_id = t.id('fom'));
  perform t.login('fom');
  perform t.raises(format($q$select public.reconcile_cashier_shift(%L, 'ok')$q$, t.id('shift1')), 'E_FORBIDDEN', '[FIN-016] a custom role copied earlier does not get the new reconcile permission');
  perform t.login('gm');
  perform t.raises(format($q$select public.reconcile_cashier_shift(%L, '')$q$, t.id('shift1')), 'E_REQUIRED', '[FIN-016] a reconcile with a difference needs a note');
  perform public.reconcile_cashier_shift(t.id('shift1'), 'Checked the drawer and the receipts. Short by 1,000, change given.');
  perform t.admin();
  perform t.ok((select reconciled_at is not null and reconciled_by = t.id('gm') from public.cashier_shifts where id = t.id('shift1')), '[FIN-016] the shift shows who reconciled it');
  perform t.login('gm');
  perform t.raises(format($q$select public.reconcile_cashier_shift(%L, 'again')$q$, t.id('shift1')), 'E_INVALID', '[FIN-016] a shift is reconciled once');
  -- Segregation: a manager who closed a shift cannot reconcile it.
  v_s := public.open_cashier_shift(t.id('propA'), 0, 'sh-gm');
  perform public.close_cashier_shift(v_s, '[]'::jsonb, null);
  perform t.raises(format($q$select public.reconcile_cashier_shift(%L, 'self')$q$, v_s), 'E_SOD', '[FIN-016] nobody reconciles their own shift');
  perform t.login('adminB');
  perform t.eq(jsonb_array_length(public.list_cashier_shifts((select id from public.properties where tenant_id = t.id('tenantB') limit 1), null, null, null)), 0, '[FIN-016] another hotel sees none of these shifts');
  perform t.admin();
end $$;

-- A hotel can insist on a shift before any payment.
do $$
declare v_s uuid;
begin
  perform t.login('csh');
  perform t.raises(format($q$select public.set_cashier_shift_required(%L, true)$q$, t.id('propA')), 'E_FORBIDDEN', '[FIN-016] a cashier cannot change the shift rule');
  perform t.login('adminA');
  perform public.set_cashier_shift_required(t.id('propA'), true);
  perform t.login('csh');
  perform t.raises(format($q$select public.post_payment(%L, %L, 1000, 'NGN', false, null, 'NS-1', 'sh-pay-ns')$q$, t.id('shiftf'), t.pm('CASH')), 'E_NO_SHIFT', '[FIN-016] with the rule on, a payment needs an open shift');
  v_s := public.open_cashier_shift(t.id('propA'), 0, 'sh-3');
  perform t.lives(format($q$select public.post_payment(%L, %L, 1000, 'NGN', false, null, 'NS-1', 'sh-pay-ns2')$q$, t.id('shiftf'), t.pm('CASH')), '[FIN-016] and works once a shift is open');
  perform t.login('adminA');
  perform public.set_cashier_shift_required(t.id('propA'), false);
  perform t.admin();
  perform t.put('shift3', v_s);
end $$;

-- Night audit flags: what is still open before the day closes.
do $$
declare j jsonb;
begin
  perform t.login('csh');
  perform t.raises(format($q$select public.night_audit_flags(%L)$q$, t.id('propA')), 'E_FORBIDDEN', '[DAY-005] a cashier cannot read the night audit flags');
  perform t.login('fom');
  j := public.night_audit_flags(t.id('propA'));
  perform t.eq(j->>'business_date', t.bdate()::text, '[DAY-005] the flags are for the hotel''s business date');
  perform t.ok(exists (select 1 from jsonb_array_elements(j->'blocking') x where x->>'code' = 'open_shifts' and (x->>'count')::int >= 1),
    '[DAY-005] an open cashier shift is a blocking flag');
  perform t.login('csh');
  perform public.close_cashier_shift(t.id('shift3'), jsonb_build_array(jsonb_build_object('payment_method_id', t.pm('CASH'), 'counted', 900)), 'Short by 100');
  perform t.login('fom');
  j := public.night_audit_flags(t.id('propA'));
  perform t.ok(not exists (select 1 from jsonb_array_elements(j->'blocking') x where x->>'code' = 'open_shifts'), '[DAY-005] once the shift is closed the blocking flag goes');
  perform t.ok(exists (select 1 from jsonb_array_elements(j->'warnings') x where x->>'code' = 'unreconciled_shifts'),
    '[DAY-005] a closed shift with a difference that nobody reconciled is a warning');
  perform t.admin();
  perform t.set_bdate(t.id('propA'), t.bdate() + 2);
  perform t.login('fom');
  j := public.night_audit_flags(t.id('propA'));
  perform t.ok(exists (select 1 from jsonb_array_elements(j->'warnings') x where x->>'code' = 'departures_in_house'),
    '[DAY-005] a guest still in house past departure is a warning');
  perform t.admin();
  -- A guest due to arrive today who has not checked in.
  perform t.login('fdo');
  perform t.book(t.id('g1'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform t.login('fom');
  perform t.ok(exists (select 1 from jsonb_array_elements(public.night_audit_flags(t.id('propA'))->'warnings') x where x->>'code' = 'arrivals_waiting'),
    '[DAY-005] a booking due today that has not checked in is a warning');
  perform t.login('adminB');
  perform t.raises(format($q$select public.night_audit_flags(%L)$q$, t.id('propA')), 'E_FORBIDDEN', '[DAY-005] another hotel cannot read these flags');
  perform t.admin();
end $$;

rollback;

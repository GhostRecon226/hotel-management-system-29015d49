-- Ledger, tax, payments, approvals, reversals, refunds, transfers, folios and invoices (ported from reference 12_ledger).
begin;

-- Set-up: guest g1 in house in room 101 with an open folio.
do $$
declare v_res uuid;
begin
  perform t.login('fdo');
  v_res := t.book(t.id('g1'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  perform public.check_in(v_res, t.reg(), t.room('101'), null, null);
  perform t.admin();
  perform t.put('res1', v_res); perform t.put('f1', t.main_folio(v_res));
exception when others then perform t.admin(); perform t.crash('ledger set-up', sqlerrm);
end $$;

-- Charges and tax.
do $$
declare v_tx uuid; v_tx2 uuid; v_b numeric;
begin
  perform t.login('fdo');
  v_tx := public.post_charge(t.id('f1'), t.cc('REST'), 10000, false, 'Dinner', null, 'chg-1');
  perform t.put('chg1', v_tx);
  perform t.eq((select count(*)::int from public.folio_tax_lines where transaction_id = v_tx and amount <> 0), 2, '[FIN-001] charge creates the charge and two tax lines (service, VAT)');
  perform t.eq(t.balance(t.id('f1')), 11825.0000, '[FIN-001][SET-005] exclusive charge: 10,000 + 1,000 service + 825 VAT');
  v_tx2 := public.post_charge(t.id('f1'), t.cc('REST'), 11825, true, 'Inclusive', null, 'chg-2');
  perform t.eq((select amount from public.folio_transactions where id = v_tx2), 10000.0000, '[FIN-001] inclusive price solves back to a net of 10,000');
  perform t.eq(t.balance(t.id('f1')), 23650.0000, '[FIN-001] balance after inclusive charge');
  perform t.eq(public.post_charge(t.id('f1'), t.cc('REST'), 10000, false, 'Dinner', null, 'chg-1'), v_tx, '[FIN-008] same idempotency key does not post twice');
  perform t.eq(t.balance(t.id('f1')), 23650.0000, '[FIN-008] duplicate did not change the balance');
  perform t.lives(format('select public.post_charge(%L, %L, 100.50, false, %L, null, %L)', t.id('f1'), t.cc('MINIBAR'), 'Water', 'chg-3'), '[NFR-004] NGN allows two decimals');
  -- Rounding: the leftover kobo goes on the last tax that has a rate, never on a 0% tax (found in step 4).
  v_tx2 := public.post_charge(t.id('f1'), t.cc('REST'), 7777.77, false, 'Odd amount', null, 'chg-odd');
  perform t.eq((select coalesce(sum(amount), 0) from public.folio_tax_lines where transaction_id = v_tx2 and percent = 0), 0::numeric,
    '[FIN-001] a 0% tax line never carries a rounding remainder');
  perform t.eq((select sum(amount) from public.folio_tax_lines where transaction_id = v_tx2), round(7777.77 * 0.1825, 2),
    '[FIN-001] total tax on an odd amount is the rounded combined rate (1,419.44)');
  perform t.raises(format('select public.post_charge(%L, %L, 100.123, false, %L, null, %L)', t.id('f1'), t.cc('MINIBAR'), 'Water', 'chg-4'), 'E_PRECISION|E_INVALID', '[NFR-004][S6] NGN refuses three decimals');
  perform t.raises(format('select public.post_charge(%L, %L, -500, false, %L, null, %L)', t.id('f1'), t.cc('REST'), 'x', 'chg-5'), 'E_INVALID', 'negative amount refused');
  perform t.raises(format('select public.post_payment(%L, %L, 10, %L, false, null, null, %L)', t.id('f1'), t.pm('CASH'), 'EUR', 'pay-eur'), 'E_NO_RATE|E_INVALID', '[SET-007] foreign currency without a rate is refused');
  perform t.login('hks');
  perform t.raises(format('select public.post_charge(%L, %L, 100, false, %L, null, %L)', t.id('f1'), t.cc('REST'), 'x', 'chg-6'), 'E_FORBIDDEN|E_NOT_FOUND', 'housekeeping cannot post charges');
  perform t.raises(format('insert into public.folio_transactions(tenant_id, property_id, folio_id, kind, amount, currency, base_amount) values (%L, %L, %L, %L, 1, %L, 1)',
    t.id('tenantA'), t.id('propA'), t.id('f1'), 'charge', 'NGN'), 'permission denied|row-level security', '[FIN-006] nobody can insert ledger rows directly');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('charges', sqlerrm);
end $$;

-- Payments, deposits, foreign currency, folio visibility.
do $$
declare v_b0 numeric; v_tx uuid; v_res uuid; v_n int;
begin
  perform t.login('fdo');
  v_b0 := t.balance(t.id('f1'));
  perform public.post_payment(t.id('f1'), t.pm('CASH'), 5000, 'NGN', false, null, null, 'pay-1');
  perform t.eq(t.balance(t.id('f1')), v_b0 - 5000, '[FIN-002] payment lowers the balance');
  v_tx := public.post_payment(t.id('f1'), t.pm('CASH'), 10, 'USD', false, null, null, 'pay-usd');
  perform t.eq((select abs(base_amount) from public.folio_transactions where id = v_tx), 15000.0000, '[FIN-003] USD 10 at 1,500 is 15,000 in naira');
  perform t.eq((select fx_rate from public.folio_transactions where id = v_tx), 1500::numeric, '[FIN-003] exchange rate is recorded on the row');
  v_res := t.book(t.id('g2'), t.bdate() + 5, t.bdate() + 7, t.id('std'), t.id('prepaid'));
  perform public.post_payment(public.open_main_folio(v_res), t.pm('CASH'), 50000, 'NGN', true, 'Deposit', null, 'dep-1');
  perform t.admin();
  perform t.eq(app.deposit_paid(v_res), 50000.0000, '[RES-010] deposit counts as paid');
  perform t.login('fdo');
  perform t.eq((select deposit_required from public.reservations where id = v_res), 50000.0000, '[RES-010] deposit rate plan asks for half of the stay');
  perform t.login('rsv');
  v_res := t.book(t.id('g3'), t.bdate() + 30, t.bdate() + 31, t.id('std'), t.id('bar'));
  perform t.lives(format('select public.post_payment(public.open_main_folio(%L), %L, 10000, %L, true, %L, null, %L)', v_res, t.pm('CASH'), 'NGN', 'Deposit', 'dep-rsv'),
    '[FIN-015] a reservation officer can take a deposit on their own booking');
  perform t.raises(format('select public.post_payment(public.open_main_folio(%L), %L, 100, %L, false, null, null, %L)', v_res, t.pm('CASH'), 'NGN', 'pay-rsv'),
    'E_FORBIDDEN', '[FIN-002][6a] reservation officer cannot take a normal payment, even on their own booking');
  select count(*) into v_n from public.folios;
  perform t.eq(v_n, 1, '[FIN-015] reservation officer sees only folios of own bookings');
  select count(*) into v_n from public.v_folio_balances;
  perform t.eq(v_n, 1, '[FIN-015] and only their balances');
  select count(*) into v_n from public.folio_transactions where folio_id = t.id('f1');
  perform t.eq(v_n, 0, '[FIN-015] and no rows of a colleague''s folio');
  perform t.raises(format('select public.post_payment(%L, %L, 100, %L, true, null, null, %L)', t.id('f1'), t.pm('CASH'), 'NGN', 'dep-other'),
    'E_NOT_FOUND|E_FORBIDDEN', '[FIN-015] and cannot post to a colleague''s folio');
  perform t.login('fom');
  select count(*) into v_n from public.folios;
  perform t.ok(v_n >= 3, '[FIN-015] a manager sees every folio');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('payments', sqlerrm);
end $$;

-- The ledger is immutable, even for the database owner.
do $$
begin
  perform t.admin();
  perform t.raises(format('update public.folio_transactions set amount = 1 where id = %L', t.id('chg1')), 'E_IMMUTABLE', '[FIN-006] posted amount cannot be updated');
  perform t.raises(format('update public.folio_transactions set kind = %L where id = %L', 'payment', t.id('chg1')), 'E_IMMUTABLE', '[FIN-006] posted row cannot change kind');
  perform t.raises(format('delete from public.folio_transactions where id = %L', t.id('chg1')), 'E_IMMUTABLE', '[FIN-006] ledger rows cannot be deleted');
  perform t.raises('truncate public.folio_tax_lines, public.folio_transactions cascade', 'E_IMMUTABLE', '[FIN-006] ledger cannot be truncated');
  perform t.raises(format('insert into public.folio_transactions(tenant_id, property_id, folio_id, kind, charge_code_id, amount, currency, base_amount, business_date, idempotency_key) values (%L, %L, %L, %L, %L, 100, %L, 100, %L, gen_random_uuid()::text)',
    t.id('tenantA'), t.id('propA'), t.id('f1'), 'charge', t.cc('REST'), 'NGN', t.bdate() - 3), 'E_DATE|E_INVALID', '[FIN-014] posting to a past business date is refused');
  perform t.raises(format('insert into public.folio_transactions(tenant_id, property_id, folio_id, kind, charge_code_id, amount, currency, base_amount, business_date, idempotency_key) values (%L, %L, %L, %L, %L, -100, %L, -100, %L, gen_random_uuid()::text)',
    t.id('tenantA'), t.id('propA'), t.id('f1'), 'charge', t.cc('REST'), 'NGN', t.bdate()), 'check constraint|E_INVALID', '[FIN-006] a charge cannot carry a negative sign');
exception when others then perform t.crash('immutability', sqlerrm);
end $$;

-- Discounts and approvals.
do $$
declare j jsonb; v_b numeric; v_ap uuid;
begin
  perform t.login('fdo');
  j := public.apply_discount(t.id('chg1'), 3000, 'Loyal guest', 'disc-1');
  perform t.eq(j->>'status', 'posted', '[FIN-004] discount within limit posts at once');
  v_b := t.balance(t.id('f1'));
  j := public.apply_discount(t.id('chg1'), 6000, 'Complaint', 'disc-2');
  perform t.eq(j->>'status', 'pending', '[FIN-004] discount above limit waits for approval');
  v_ap := (j->>'approval_id')::uuid; perform t.put('ap_disc', v_ap);
  perform t.eq(t.balance(t.id('f1')), v_b, '[FIN-013] pending discount does not change the balance');
  perform t.raises(format('select public.decide_approval(%L, true, %L)', v_ap, 'ok'), 'E_FORBIDDEN|E_SOD', '[FIN-004] front desk cannot approve discounts');
  perform t.raises(format('select public.apply_discount(%L, 100, %L, %L)', t.id('chg1'), '', 'disc-3'), 'E_REQUIRED', '[ADM-007] discount needs a reason');
  perform t.login('fom');
  perform t.eq((select count(*)::int from public.approvals where id = v_ap and status = 'pending'), 1, '[ADM-008] manager sees the pending discount');
  perform public.decide_approval(v_ap, true, 'Agreed');
  -- The discount amount includes tax, and the tax is reduced in proportion (the screen says so).
  perform t.eq(t.balance(t.id('f1')), v_b - 6000, '[FIN-004] an approved discount of 6,000 (tax included) lowers the balance by 6,000');
  perform t.ok((select count(*) = 2 and sum(x.amount) < 0 from public.folio_tax_lines x join public.folio_transactions d on d.id = x.transaction_id
    where d.folio_id = t.id('f1') and d.kind = 'discount' and d.idempotency_key like 'approval:%' and x.amount <> 0),
    '[FIN-004] and reduces service charge and VAT in proportion (accountant to confirm the treatment)');
  perform t.ok(t.balance(t.id('f1')) < v_b, '[FIN-004] approved discount posts');
  perform t.raises(format('select public.decide_approval(%L, true, %L)', v_ap, 'again'), 'E_INVALID', 'a decided approval cannot be decided again');
  perform t.login('fdo');
  j := public.apply_discount(public.post_charge(t.id('f1'), t.cc('REST'), 20000, false, 'Party', null, 'chg-rej'), 6000, 'Too much', 'disc-4');
  perform t.login('fom');
  perform t.raises(format('select public.decide_approval(%L, false, %L)', (j->>'approval_id')::uuid, ''), 'E_REQUIRED', 'rejection needs a reason');
  perform public.decide_approval((j->>'approval_id')::uuid, false, 'No');
  perform t.eq((select status from public.approvals where id = (j->>'approval_id')::uuid), 'rejected', 'rejected discount is marked rejected');
  j := public.apply_discount(public.post_charge(t.id('f1'), t.cc('REST'), 50000, false, 'Banquet', null, 'chg-big'), 21000, 'Big one', 'disc-5');
  perform t.eq(j->>'status', 'pending', 'a manager above their own limit also needs approval');
  perform t.raises(format('select public.decide_approval(%L, true, %L)', (j->>'approval_id')::uuid, 'mine'), 'E_SOD', '[D2] the requester cannot approve their own request');
  perform t.admin();
  perform t.raises(format('update public.approvals set status = %L, decided_by = requested_by, decided_at = now() where id = %L', 'approved', (j->>'approval_id')::uuid),
    'approvals_sod|check constraint|E_SOD', '[D2] the database itself refuses self-approval');
exception when others then perform t.admin(); perform t.crash('discounts', sqlerrm);
end $$;

-- Adjustments need a second person within the approver's limit.
do $$
declare j jsonb;
begin
  perform t.login('fdo');
  j := public.request_adjustment(t.id('f1'), t.cc('REST'), -50000, 'Wrong bill', 'adj-1');
  perform t.eq(j->>'status', 'pending', '[D1] an adjustment always waits for approval');
  perform t.login('fom');
  perform t.raises(format('select public.decide_approval(%L, true, %L)', (j->>'approval_id')::uuid, 'ok'), 'E_LIMIT', '[FIN-005] manager cannot approve above their limit');
  perform t.login('acc');
  perform t.lives(format('select public.decide_approval(%L, true, %L)', (j->>'approval_id')::uuid, 'ok'), '[FIN-005] senior approver posts the adjustment');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('adjustments', sqlerrm);
end $$;

-- Reversals.
do $$
declare j jsonb; v_tx uuid; v_b numeric; v_rev uuid;
begin
  perform t.login('fdo');
  v_b := t.balance(t.id('f1'));
  v_tx := public.post_charge(t.id('f1'), t.cc('LAUNDRY'), 2000, false, 'Laundry', null, 'chg-rev');
  perform t.login('fom');
  j := public.request_reversal(v_tx, 'Posted in error', 'rev-1');
  perform t.eq(j->>'status', 'pending', '[D1] a reversal always waits for approval');
  perform t.login('acc');
  perform public.decide_approval((j->>'approval_id')::uuid, true, 'ok');
  perform t.eq(t.balance(t.id('f1')), v_b, '[FIN-006] reversal removes the charge and its tax');
  select id into v_rev from public.folio_transactions where original_id = v_tx and kind = 'reversal';
  perform t.ok(v_rev is not null, '[FIN-006] the reversal row links to the original');
  perform t.login('fom');
  perform t.raises(format('select public.request_reversal(%L, %L, %L)', v_tx, 'again', 'rev-2'), 'E_ALREADY_REVERSED|E_INVALID', '[FIN-006] a charge is reversed only once');
  perform t.raises(format('select public.request_reversal(%L, %L, %L)', v_rev, 'undo', 'rev-3'), 'E_INVALID|E_ALREADY_REVERSED', '[FIN-006] a reversal cannot be reversed');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('reversals', sqlerrm);
end $$;

-- Refunds are capped at the credit.
do $$
declare v_res uuid; v_f uuid; j jsonb;
begin
  perform t.login('fdo');
  v_res := t.book(t.id('g3'), t.bdate() + 40, t.bdate() + 41, t.id('std'), t.id('bar'));
  v_f := public.open_main_folio(v_res);
  perform public.post_payment(v_f, t.pm('CASH'), 3000, 'NGN', false, null, null, 'pay-cr');
  perform t.raises(format('select public.request_refund(%L, %L, 5000, %L, null, %L, %L)', v_f, t.pm('CASH'), 'NGN', 'refund', 'ref-1'),
    'E_INVALID|E_REFUND_LIMIT', '[FIN-007] a refund cannot exceed the credit on the folio');
  j := public.request_refund(v_f, t.pm('CASH'), 3000, 'NGN', null, 'Guest cancelled', 'ref-2');
  perform t.eq(t.balance(v_f), -3000.0000, '[FIN-013] a pending refund does not change the balance');
  perform t.login('csh');
  perform t.raises(format('select public.decide_approval(%L, true, %L)', (j->>'approval_id')::uuid, 'ok'), 'E_FORBIDDEN|E_NOT_FOUND', 'cashier cannot approve a refund');
  perform t.login('acc');
  perform public.decide_approval((j->>'approval_id')::uuid, true, 'ok');
  perform t.eq(t.balance(v_f), 0.0000, '[FIN-007] approved refund pays out of the credit');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('refunds', sqlerrm);
end $$;

-- Split folios and transfers.
do $$
declare v_tx uuid; v_f2 uuid; v_total numeric; v_b1 numeric;
begin
  perform t.login('fdo');
  v_tx := public.post_charge(t.id('f1'), t.cc('REST'), 4000, false, 'Company dinner', null, 'chg-tr');
  v_total := t.balance(t.id('f1'));
  v_f2 := public.split_folio(t.id('f1'), 'Company', null, null, 'split-1');
  perform t.ok(v_f2 is not null, '[FIN-010] staff can add a second folio');
  perform t.raises(format('select public.transfer_transaction(%L, %L, %L)', v_tx, v_f2, 'tr-fdo'), 'E_FORBIDDEN', '[FIN-009] front desk cannot transfer between folios');
  perform t.ok(exists (select 1 from public.permissions where key = 'fin.folio.transfer'), '[FIN-009] transfers have their own permission');
  perform t.login('fom');
  perform public.transfer_transaction(v_tx, v_f2, 'tr-1');
  perform t.eq(t.balance(v_f2), 4730.0000, '[FIN-009] target folio receives the charge and its tax');
  perform t.eq(t.balance(t.id('f1')), v_total - 4730, '[FIN-009] source folio is relieved');
  perform t.raises(format('select public.transfer_transaction(%L, %L, %L)', v_tx, v_f2, 'tr-2'), 'E_ALREADY_REVERSED|E_INVALID', '[FIN-009] a charge is transferred once');
  perform t.eq(t.balance(t.id('f1')) + t.balance(v_f2), v_total, '[FIN-009] transfers net to zero across folios');
  perform t.put('f2', v_f2);
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('transfers', sqlerrm);
end $$;

-- Closing, invoices and reopening.
do $$
declare v_b numeric; v_inv uuid; v_res uuid; v_f uuid;
begin
  perform t.login('fdo');
  v_res := t.book(t.id('g2'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform public.check_in(v_res, t.reg(), t.room('102'), null, null);
  v_f := t.main_folio(v_res);
  perform public.post_charge(v_f, t.cc('REST'), 10000, false, 'Lunch', null, 'chg-inv');
  perform t.login('hks');
  perform t.raises(format('select public.close_folio(%L)', v_f), 'E_FORBIDDEN|E_NOT_FOUND', 'housekeeping cannot close a folio');
  perform t.login('fdo');
  perform t.raises(format('select public.close_folio(%L)', v_f), 'E_BALANCE_DUE|E_INVALID', '[FIN-011] a folio with a balance cannot be closed');
  perform public.post_payment(v_f, t.pm('CASH'), t.balance(v_f), 'NGN', false, null, null, 'pay-inv');
  perform t.eq(t.balance(v_f), 0.0000, 'settled folio has a zero balance');
  perform public.close_folio(v_f);
  v_inv := public.issue_invoice(v_f, 'final', 'inv-1');
  perform t.eq((select gross_total from public.invoices where id = v_inv), 11825.0000, '[FIN-012] invoice total equals what was charged');
  perform t.eq((select tax_total from public.invoices where id = v_inv), 1825.0000, '[FIN-012] invoice shows the tax separately');
  perform t.eq((select balance from public.invoices where id = v_inv), 0.0000, '[FIN-012] invoice balance is zero');
  perform t.raises(format('select public.post_charge(%L, %L, 100, false, %L, null, %L)', v_f, t.cc('REST'), 'x', 'chg-closed'), 'E_FOLIO_CLOSED', '[FIN-011] a closed folio takes no postings');
  perform t.raises(format('select public.reopen_folio(%L, %L)', v_f, 'x'), 'E_FORBIDDEN', '[FIN-011] front desk cannot reopen a folio');
  perform t.login('acc');
  perform t.raises(format('select public.reopen_folio(%L, %L)', v_f, ''), 'E_REQUIRED', '[FIN-011] reopening needs a reason');
  perform public.reopen_folio(v_f, 'Missed minibar');
  perform t.eq((select status from public.folios where id = v_f), 'open', '[FIN-011] accountant reopened the folio');
  perform t.admin();
  perform t.raises(format('update public.invoices set gross_total = 1 where id = %L', v_inv), 'E_IMMUTABLE', '[FIN-012] an issued invoice cannot be changed');
  perform t.ok(exists (select 1 from public.audit_events where table_name = 'folios' and record_id = v_f::text and reason = 'Missed minibar'), '[ADM-007] reopen is in the audit trail');
exception when others then perform t.admin(); perform t.crash('folios and invoices', sqlerrm);
end $$;

rollback;

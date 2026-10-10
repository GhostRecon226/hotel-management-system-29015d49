-- [FIN-021] Collections follow-up: guests who left owing money, with a log of chasing notes.
begin;

do $$
declare v_r uuid; v_f uuid; v_n uuid; j jsonb; l record; v_paid uuid;
begin
  perform t.login('adminA');
  perform public.save_room(t.id('propA'), null, '197', t.id('std'), '1', true);
  perform public.save_room(t.id('propA'), null, '198', t.id('std'), '1', true);
  perform t.admin();
  perform t.login('fdo');
  -- Guest 1 leaves owing 5,000. Guest 2 leaves and pays in full.
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('197'), null, null);
  v_f := t.main_folio(v_r);
  perform public.post_charge(v_f, t.cc('REST'), 5000, false, 'Dinner', null, 'col-chg-1');
  v_paid := t.book(t.id('g2'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform public.check_in(v_paid, t.reg(), t.room('198'), null, null);
  perform public.post_check_out_charge(v_paid);
  perform public.post_charge(t.main_folio(v_paid), t.cc('REST'), 2000, false, 'Lunch', null, 'col-chg-2');
  perform public.post_payment(t.main_folio(v_paid), t.pm('CASH'), t.balance(t.main_folio(v_paid)), 'NGN', false, null, null, 'col-pay-2');
  perform t.login('fom');
  perform public.check_out(v_r, null, 'Company will pay');
  perform t.login('fdo');
  perform public.check_out(v_paid, null, null);
  perform t.admin();

  perform t.login('acc');
  select * into l from public.collections_list(t.id('propA')) where reservation_id = v_r;
  perform t.ok(l.folio_id = v_f and l.balance = t.balance(v_f) and l.balance > 5000, '[FIN-021] a guest who left owing is on the list with the balance from the ledger');
  perform t.ok(not exists (select 1 from public.collections_list(t.id('propA')) where reservation_id = v_paid), '[FIN-021] a guest who paid in full is not on the list');
  perform t.ok(l.notes_count = 0 and l.last_outcome is null and l.promised_date is null and l.follow_up_due, '[FIN-021] a new debt has no notes yet and is due for a first call');

  -- Logging a follow-up.
  perform t.raises(format('select public.add_collection_note(%L, %L, %L, null)', v_f, 'called', ''), 'E_REQUIRED', '[FIN-021] a note needs text');
  perform t.raises(format('select public.add_collection_note(%L, %L, %L, null)', v_f, 'shrug', 'x'), 'E_INVALID', '[FIN-021] an unknown outcome is refused');
  perform t.raises(format('select public.add_collection_note(%L, %L, %L, null)', v_f, 'promised', 'Will pay Friday'), 'E_REQUIRED', '[FIN-021] a promise needs a date');
  perform t.raises(format('select public.add_collection_note(%L, %L, %L, %L)', v_f, 'promised', 'Will pay', t.bdate() - 1), 'E_INVALID', '[FIN-021] a promised date cannot be in the past');
  v_n := public.add_collection_note(v_f, 'promised', 'Finance manager will pay on Friday', t.bdate() + 3);
  perform t.ok(v_n is not null, '[FIN-021] a promise with a date is saved');
  select * into l from public.collections_list(t.id('propA')) where reservation_id = v_r;
  perform t.ok(l.notes_count = 1 and l.last_outcome = 'promised' and l.promised_date = t.bdate() + 3 and not l.follow_up_due,
    '[FIN-021] the list shows the last outcome and promised date, and nothing is due yet');
  perform public.add_collection_note(v_f, 'called', 'Rang the finance office, no answer', null);
  perform public.add_collection_note(v_f, 'unreachable', 'Phone switched off', null);
  select * into l from public.collections_list(t.id('propA')) where reservation_id = v_r;
  perform t.ok(l.notes_count = 3 and l.last_outcome = 'unreachable' and l.promised_date = t.bdate() + 3 and not l.follow_up_due,
    '[FIN-021] a later note does not cancel a promise that is still ahead');
  perform t.admin();
  perform t.eq((select count(*)::int from public.collection_notes where folio_id = v_f), 3, '[FIN-021] every note is kept');

  -- A promise that has passed puts the debt back on the due list.
  update public.collection_notes set promised_date = t.bdate() - 2, business_date = t.bdate() - 3 where folio_id = v_f;
  perform t.login('acc');
  select * into l from public.collections_list(t.id('propA')) where reservation_id = v_r;
  perform t.ok(l.follow_up_due, '[FIN-021] a broken promise is due for follow-up');

  -- With no promise on file, a debt comes back after 7 days without a note.
  perform t.admin();
  update public.collection_notes set promised_date = null, business_date = t.bdate() - 8 where folio_id = v_f;
  perform t.login('acc');
  select * into l from public.collections_list(t.id('propA')) where reservation_id = v_r;
  perform t.ok(l.follow_up_due, '[FIN-021] a debt with no promise is due again after 7 days without a note');

  -- Nothing to collect, no note.
  perform t.raises(format('select public.add_collection_note(%L, %L, %L, null)', t.main_folio(v_paid), 'called', 'x'), 'E_INVALID', '[FIN-021] a settled bill cannot get a collection note');

  -- Who can do what.
  perform t.login('hks');
  perform t.raises(format('select * from public.collections_list(%L)', t.id('propA')), 'E_FORBIDDEN', '[FIN-021] housekeeping cannot read the list');
  perform t.raises(format('select public.add_collection_note(%L, %L, %L, null)', v_f, 'called', 'x'), 'E_NOT_FOUND|E_FORBIDDEN', '[FIN-021] housekeeping cannot add a note');
  perform t.login('adminB');
  perform t.raises(format('select public.add_collection_note(%L, %L, %L, null)', v_f, 'called', 'x'), 'E_NOT_FOUND', '[FIN-021] another hotel cannot add a note');
  perform t.raises(format('select * from public.collections_list(%L)', t.id('propA')), 'E_NOT_FOUND|E_FORBIDDEN', '[FIN-021] another hotel cannot read the list');
  perform t.anon();
  perform t.raises(format('select * from public.collections_list(%L)', t.id('propA')), 'permission denied', '[FIN-021] signed-out users cannot read the list');
  perform t.admin();
  perform t.ok(not has_table_privilege('authenticated', 'public.collection_notes', 'insert'), '[FIN-021] the browser cannot write notes directly');
end $$;

rollback;

-- DAY-008: the date rolls even when a cashier shift is open; the roll records it and tells night audit users once.
begin;

do $$
declare r jsonb; v_log jsonb;
begin
  perform t.admin();
  r := app.roll_property(t.id('propA'), 'manual', null);
  perform t.eq(r->>'status', 'success', '[DAY-008] roll with no open shift succeeds');
  perform t.eq((r->>'open_shifts')::int, 0, '[DAY-008] no open shift is recorded as zero');
  perform t.ok(not exists (select 1 from public.notifications where kind = 'rollover_open_shifts' and property_id = t.id('propA')),
    '[DAY-008] no notice when no shift was open');

  perform t.login('csh');
  perform public.open_cashier_shift(t.id('propA'), 1000, 'roll-sh-1');
  perform t.admin();

  r := app.roll_property(t.id('propA'), 'manual', null);
  perform t.eq(r->>'status', 'success', '[DAY-008] the roll does not wait for an open shift');
  perform t.eq((r->>'open_shifts')::int, 1, '[DAY-008] the roll result counts the open shift');
  select details into v_log from public.business_date_log where property_id = t.id('propA') order by to_date desc limit 1;
  perform t.eq((v_log->>'open_shifts')::int, 1, '[DAY-008] the roll log keeps the open shift count');
  perform t.ok(exists (select 1 from public.notifications where kind = 'rollover_open_shifts' and user_id = t.id('adminA') and property_id = t.id('propA')),
    '[DAY-008] night audit users get one notice');
  perform t.ok(not exists (select 1 from public.notifications where kind = 'rollover_open_shifts' and user_id = t.id('hks')),
    '[DAY-008] staff without night audit rights do not');
  perform t.eq((select count(*)::int from public.notifications where kind = 'rollover_open_shifts' and user_id = t.id('adminA') and property_id = t.id('propA')), 1,
    '[DAY-008] exactly one notice per roll');
  perform t.admin();
end $$;

rollback;

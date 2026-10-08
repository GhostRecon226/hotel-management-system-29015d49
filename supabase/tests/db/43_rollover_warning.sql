-- DAY-007: warn the night audit users before the business date rolls, when a cashier shift is still open.
begin;

do $$
declare p public.properties; v_next timestamptz; v_n int;
begin
  perform t.admin();
  select * into p from public.properties where id = t.id('propA');
  v_next := ((p.business_date + 1)::timestamp + p.rollover_time) at time zone p.timezone;

  v_n := app.warn_before_rollover(v_next - interval '30 minutes');
  perform t.eq(v_n, 0, '[DAY-007] no open shift, no warning');

  perform t.login('csh');
  perform public.open_cashier_shift(t.id('propA'), 1000, 'warn-sh-1');
  perform t.admin();

  v_n := app.warn_before_rollover(v_next - interval '3 hours');
  perform t.eq(v_n, 0, '[DAY-007] more than an hour before the roll, no warning');

  v_n := app.warn_before_rollover(v_next - interval '30 minutes');
  perform t.ok(v_n > 0, '[DAY-007] inside the last hour with a shift open, night audit users are warned');
  perform t.ok(exists (select 1 from public.notifications where kind = 'rollover_warning' and user_id = t.id('adminA') and property_id = t.id('propA')),
    '[DAY-007] the System Administrator gets the warning');
  perform t.ok(not exists (select 1 from public.notifications where kind = 'rollover_warning' and user_id = t.id('hks')),
    '[DAY-007] staff without night audit rights do not');

  v_n := app.warn_before_rollover(v_next - interval '10 minutes');
  perform t.eq(v_n, 0, '[DAY-007] a second check in the same hour sends nothing more');

  v_n := app.warn_before_rollover(v_next + interval '5 minutes');
  perform t.eq(v_n, 0, '[DAY-007] after the roll time there is no warning (the roll itself runs)');

  perform t.ok(exists (select 1 from cron.job where jobname = 'rollover-warning'), '[DAY-007] the check is scheduled every 5 minutes');
  perform t.admin();
end $$;

do $$
begin
  perform t.login('adminA');
  perform t.raises('select app.warn_before_rollover()', 'permission denied', '[DAY-007] signed-in users cannot call the check directly');
  perform t.admin();
end $$;

rollback;

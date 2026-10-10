-- Trial and overdue-payment notices (QA-05, Peter's decision of 10 Oct 2026).
-- The daily subscription clock now also emails the hotel's active System Administrators and General Managers:
--   trial:    7 days before it ends, 1 day before, and when it ends
--   overdue:  when payment is first overdue, when 3 days of the 14-day grace remain, and when the hotel is suspended
-- Status changes behave exactly as before (20260930110100_subscription_clock.sql). Each email has a dedupe key
-- (kind:tenant:date:user), so a repeat run never sends twice. The status is read at send time, so a hotel that
-- converts or is activated before the date gets nothing. Billing checkout is not on yet, so every email says to
-- contact hello@zikorahq.com. No prices.

-- Queue one email to each active System Administrator and General Manager of a hotel.
create or replace function app.send_subscription_notice(p_tenant uuid, p_kind text, p_date date, p_subject text, p_body text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r record;
begin
  for r in
    select distinct u.id as user_id, u.email
    from public.user_property_roles upr
    join public.roles ro on ro.id = upr.role_id and ro.tenant_id is null and ro.code in ('SYSADMIN', 'GM')
    join public.profiles p on p.id = upr.user_id and p.status = 'active' and p.tenant_id = p_tenant
    join auth.users u on u.id = p.id
    where upr.tenant_id = p_tenant and coalesce(btrim(u.email), '') <> ''
  loop
    perform app.enqueue_message(p_tenant, null, 'email', r.email, p_subject, p_body,
      p_kind || ':' || p_tenant || ':' || p_date || ':' || r.user_id);
  end loop;
end $$;

create or replace function app.run_subscription_clock()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record; n integer := 0; v_changed boolean; v_status text;
  v_hotel text; v_end date; v_grace_end date; v_day text;
begin
  for r in
    select s.tenant_id, s.status, s.trial_ends_at, s.current_period_end, t.status as access, t.name as hotel
    from public.tenant_subscriptions s join public.tenants t on t.id = s.tenant_id
    for update of s
  loop
    v_changed := false;
    v_status := r.status;
    v_hotel := r.hotel;

    -- State changes (unchanged behaviour).
    if r.status = 'trial' and r.trial_ends_at is not null and r.trial_ends_at <= now() then
      perform app.change_subscription(r.tenant_id, 'expired', 'expired', 'Free trial ended', 'clock');
      v_end := (r.trial_ends_at at time zone 'UTC')::date;
      perform app.send_subscription_notice(r.tenant_id, 'trialend', v_end,
        'Your free trial of Zikora has ended',
        'Hello,' || E'\n\n' || 'The free trial of Zikora for ' || v_hotel || ' ended on ' || to_char(v_end, 'FMDD Mon YYYY') || '. '
        || 'The hotel is now read-only: you can see everything, but you cannot add or change anything. Nothing is deleted.'
        || E'\n\n' || 'To choose a plan and get full access back, contact hello@zikorahq.com.' || E'\n\nZikora');
      n := n + 1; v_changed := true;
    elsif r.status = 'active' and r.current_period_end is not null and r.current_period_end <= now() then
      perform app.change_subscription(r.tenant_id, 'past_due', 'past_due', 'Paid period ended without payment', 'clock');
      n := n + 1; v_changed := true;
      v_status := 'past_due';
    elsif r.status = 'past_due' and r.current_period_end is not null and r.current_period_end + interval '14 days' <= now() then
      perform app.change_subscription(r.tenant_id, 'suspended', 'suspended', 'Unpaid for more than 14 days', 'clock');
      v_end := (r.current_period_end at time zone 'UTC')::date;
      perform app.send_subscription_notice(r.tenant_id, 'suspended', v_end,
        'Zikora is now read-only for your hotel',
        'Hello,' || E'\n\n' || 'Payment for ' || v_hotel || ' was not received within 14 days, so the hotel is now read-only: '
        || 'you can see everything, but you cannot add or change anything. Nothing is deleted.'
        || E'\n\n' || 'To get full access back, contact hello@zikorahq.com to arrange payment.' || E'\n\nZikora');
      n := n + 1; v_changed := true;
    elsif r.status = 'cancelled' and r.access <> 'cancelled'
          and (r.current_period_end is null or r.current_period_end <= now()) then
      perform app.change_subscription(r.tenant_id, 'cancelled', 'cancelled', 'Cancelled subscription reached the end of its paid period', 'clock');
      n := n + 1; v_changed := true;
    end if;

    -- Trial notices: only a trial that is still running, read at send time.
    if not v_changed and v_status = 'trial' and r.trial_ends_at is not null and r.trial_ends_at > now() then
      v_end := (r.trial_ends_at at time zone 'UTC')::date;
      v_day := to_char(v_end, 'FMDD Mon YYYY');
      if r.trial_ends_at - interval '1 day' <= now() then
        perform app.send_subscription_notice(r.tenant_id, 'trial1', v_end,
          'Your free trial of Zikora ends tomorrow',
          'Hello,' || E'\n\n' || 'The free trial of Zikora for ' || v_hotel || ' ends on ' || v_day || '. '
          || 'Choose a plan before ' || v_day || ' or the hotel becomes read-only. Nothing is deleted.'
          || E'\n\n' || 'To choose a plan, contact hello@zikorahq.com.' || E'\n\nZikora');
      elsif r.trial_ends_at - interval '7 days' <= now() then
        perform app.send_subscription_notice(r.tenant_id, 'trial7', v_end,
          'Your free trial of Zikora ends on ' || v_day,
          'Hello,' || E'\n\n' || 'The free trial of Zikora for ' || v_hotel || ' ends on ' || v_day || '. '
          || 'Choose a plan before ' || v_day || ' or the hotel becomes read-only. Nothing is deleted.'
          || E'\n\n' || 'To choose a plan, contact hello@zikorahq.com.' || E'\n\nZikora');
      end if;
    end if;

    -- Overdue notices: a hotel that is past due and still inside its 14-day grace period, read at send time.
    if v_status = 'past_due' and r.current_period_end is not null
       and r.current_period_end + interval '14 days' > now() then
      v_end := (r.current_period_end at time zone 'UTC')::date;
      v_grace_end := ((r.current_period_end + interval '14 days') at time zone 'UTC')::date;
      v_day := to_char(v_grace_end, 'FMDD Mon YYYY');
      perform app.send_subscription_notice(r.tenant_id, 'pastdue', v_end,
        'Payment for Zikora is overdue',
        'Hello,' || E'\n\n' || 'Payment for ' || v_hotel || ' is overdue. '
        || 'Pay by ' || v_day || ' to keep full access. After that the hotel becomes read-only. Nothing is deleted.'
        || E'\n\n' || 'To arrange payment, contact hello@zikorahq.com.' || E'\n\nZikora');
      if r.current_period_end + interval '11 days' <= now() then
        perform app.send_subscription_notice(r.tenant_id, 'pastdue3', v_end,
          'Zikora becomes read-only for your hotel on ' || v_day,
          'Hello,' || E'\n\n' || 'Payment for ' || v_hotel || ' is still overdue. '
          || 'Pay by ' || v_day || ' to keep full access. After that the hotel becomes read-only. Nothing is deleted.'
          || E'\n\n' || 'To arrange payment, contact hello@zikorahq.com.' || E'\n\nZikora');
      end if;
    end if;
  end loop;
  return n;
end $$;

revoke all on function app.send_subscription_notice(uuid, text, date, text, text), app.run_subscription_clock()
  from public, anon, authenticated;
grant execute on function app.run_subscription_clock() to service_role;

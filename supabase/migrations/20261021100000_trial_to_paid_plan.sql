-- Day 61 (PLT-018, Peter's decision of 12 Oct 2026).
-- When the 60-day free trial ends, the hotel no longer goes read-only at once. It moves to the cheapest plan it fits
-- (Starter, Standard, Pro, else Enterprise), becomes 'past_due', and has 14 days to pay. The 14 days count from the day
-- the trial ended (current_period_end = trial end). The existing rule then applies: unpaid after 14 days, the hotel
-- is suspended (read-only). Nothing is deleted. One email goes to the administrators naming the plan and the price from
-- the plans table. A hotel too big for every priced plan is told to contact us for a quote. The generic "payment overdue"
-- email is not sent on top of it. The 7 day and 1 day warnings now say which plan the hotel will move to and the price.

-- The cheapest plan the hotel fits: fewest rooms first, Enterprise (no limits) last.
create or replace function app.trial_plan(p_tenant uuid)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  with c as (
    select (select count(*) from public.rooms where tenant_id = p_tenant and is_active) as rooms,
           (select count(*) from public.properties where tenant_id = p_tenant) as props,
           (select count(*) from public.profiles where tenant_id = p_tenant and status = 'active') as users)
  select p.code from public.plans p cross join c
   where not ((p.max_rooms is not null and c.rooms > p.max_rooms)
           or (p.max_properties is not null and c.props > p.max_properties)
           or (p.max_users is not null and c.users > p.max_users))
   order by p.max_rooms nulls last, p.code
   limit 1
$$;

-- The monthly price of a plan in the hotel's currency, in words (for example ₦30,000). Null when there is no price.
create or replace function app.plan_price_text(p_plan text, p_tenant uuid)
returns text language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_cur text; v_minor bigint;
begin
  select base_currency into v_cur from public.properties where tenant_id = p_tenant order by created_at, id limit 1;
  select (prices -> v_cur ->> 'month')::bigint into v_minor from public.plans where code = p_plan;
  if v_minor is null then return null; end if;
  return case when v_cur = 'NGN' then '₦' else v_cur || ' ' end
    || case when v_minor % 100 = 0 then to_char(v_minor / 100, 'FM999,999,999,990') else to_char(v_minor / 100.0, 'FM999,999,999,990.00') end;
end $$;

-- The sentence the warning emails use.
create or replace function app.trial_plan_sentence(p_plan_name text, p_price text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case when p_price is not null
    then 'After that your hotel moves to the ' || p_plan_name || ' plan, ' || p_price || ' a month, and you have 14 days to pay. If it is not paid by then the hotel becomes read-only. Nothing is deleted.'
    else 'After that your hotel moves to the ' || p_plan_name || ' plan, which we quote for you, and you have 14 days to agree the price and pay. If it is not paid by then the hotel becomes read-only. Nothing is deleted.' end
$$;

create or replace function app.run_subscription_clock()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record; n integer := 0; v_changed boolean; v_status text;
  v_hotel text; v_end date; v_grace_end date; v_day text; v_plan text; v_pname text; v_price text;
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
      -- Day 61 (PLT-018): the hotel moves to the cheapest plan it fits and has 14 days to pay. It keeps working.
      v_plan := app.trial_plan(r.tenant_id);
      select name into v_pname from public.plans where code = v_plan;
      v_price := app.plan_price_text(v_plan, r.tenant_id);
      perform app.change_subscription(r.tenant_id, 'past_due', 'past_due', 'Free trial ended, moved to the ' || v_pname || ' plan', 'clock', r.trial_ends_at, v_plan);
      v_end := (r.trial_ends_at at time zone 'UTC')::date;
      v_grace_end := ((r.trial_ends_at + interval '14 days') at time zone 'UTC')::date;
      v_day := to_char(v_grace_end, 'FMDD Mon YYYY');
      perform app.send_subscription_notice(r.tenant_id, 'trialend', v_end,
        'Your free trial of Zikora has ended',
        'Hello,' || E'\n\n' || 'The free trial of Zikora for ' || v_hotel || ' ended on ' || to_char(v_end, 'FMDD Mon YYYY') || '. '
        || case when v_price is not null
             then 'Your hotel is now on the ' || v_pname || ' plan, ' || v_price || ' a month. Pay by ' || v_day || ' to keep full access.'
             else 'Your hotel is larger than our standard plans, so it is on the ' || v_pname || ' plan, which we quote for you. Please contact us by ' || v_day || ' to agree the price and keep full access.'
           end
        || ' After that the hotel becomes read-only: you can see everything, but you cannot add or change anything. Nothing is deleted.'
        || E'\n\n' || 'To arrange payment, contact hello@zikorahq.com.' || E'\n\nZikora');
      n := n + 1; v_changed := true;
      v_status := 'past_due';
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
      v_plan := app.trial_plan(r.tenant_id);
      select name into v_pname from public.plans where code = v_plan;
      v_price := app.plan_price_text(v_plan, r.tenant_id);
      if r.trial_ends_at - interval '1 day' <= now() then
        perform app.send_subscription_notice(r.tenant_id, 'trial1', v_end,
          'Your free trial of Zikora ends tomorrow',
          'Hello,' || E'\n\n' || 'The free trial of Zikora for ' || v_hotel || ' ends on ' || v_day || '. '
          || app.trial_plan_sentence(v_pname, v_price)
          || E'\n\n' || 'To ask a question or choose another plan, contact hello@zikorahq.com.' || E'\n\nZikora');
      elsif r.trial_ends_at - interval '7 days' <= now() then
        perform app.send_subscription_notice(r.tenant_id, 'trial7', v_end,
          'Your free trial of Zikora ends on ' || v_day,
          'Hello,' || E'\n\n' || 'The free trial of Zikora for ' || v_hotel || ' ends on ' || v_day || '. '
          || app.trial_plan_sentence(v_pname, v_price)
          || E'\n\n' || 'To ask a question or choose another plan, contact hello@zikorahq.com.' || E'\n\nZikora');
      end if;
    end if;

    -- Overdue notices: a hotel that is past due and still inside its 14-day grace period, read at send time.
    if v_status = 'past_due' and r.current_period_end is not null
       and r.current_period_end + interval '14 days' > now() then
      v_end := (r.current_period_end at time zone 'UTC')::date;
      v_grace_end := ((r.current_period_end + interval '14 days') at time zone 'UTC')::date;
      v_day := to_char(v_grace_end, 'FMDD Mon YYYY');
      if not exists (select 1 from public.notification_outbox
                      where tenant_id = r.tenant_id and dedupe_key like 'trialend:' || r.tenant_id || ':' || v_end || ':%') then
      perform app.send_subscription_notice(r.tenant_id, 'pastdue', v_end,
        'Payment for Zikora is overdue',
        'Hello,' || E'\n\n' || 'Payment for ' || v_hotel || ' is overdue. '
        || 'Pay by ' || v_day || ' to keep full access. After that the hotel becomes read-only. Nothing is deleted.'
        || E'\n\n' || 'To arrange payment, contact hello@zikorahq.com.' || E'\n\nZikora');
      end if;
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


revoke all on function app.trial_plan(uuid), app.plan_price_text(text, uuid), app.trial_plan_sentence(text, text)
  from public, anon, authenticated;
revoke all on function app.run_subscription_clock() from public, anon, authenticated;
grant execute on function app.run_subscription_clock() to service_role;

-- Rule 4: every function is security definer with a fixed search path.
-- app.trial_plan_sentence (20261021100000) was plain SQL. Same text, now security definer. Grants stay as they were
-- (nobody but the database owner can call it).
create or replace function app.trial_plan_sentence(p_plan_name text, p_price text)
returns text language sql immutable security definer set search_path = public, pg_temp as $$
  select case when p_price is not null
    then 'After that your hotel moves to the ' || p_plan_name || ' plan, ' || p_price || ' a month, and you have 14 days to pay. If it is not paid by then the hotel becomes read-only. Nothing is deleted.'
    else 'After that your hotel moves to the ' || p_plan_name || ' plan, which we quote for you, and you have 14 days to agree the price and pay. If it is not paid by then the hotel becomes read-only. Nothing is deleted.' end
$$;

revoke all on function app.trial_plan_sentence(text, text) from public, anon, authenticated;

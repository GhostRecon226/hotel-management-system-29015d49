-- Free cancellation defaults to 2 days before arrival, changeable per rate plan (decision 6d).
--
-- Before: the setting could be empty, which meant the cancellation fee always applied.
-- After: new rate plans get 2 days unless another value is given, existing plans without a setting get
-- 2, and the setting can no longer be empty. 0 means "the fee always applies". Saving a plan without
-- the setting keeps its current value.

update public.rate_plans set cancellation_free_days = 2 where cancellation_free_days is null;
alter table public.rate_plans alter column cancellation_free_days set default 2;
alter table public.rate_plans alter column cancellation_free_days set not null;
comment on column public.rate_plans.cancellation_free_days is
  'Cancelling at least this many days before arrival is free. 0: the cancellation fee always applies. Default 2 (decision 6d).';

CREATE OR REPLACE FUNCTION public.save_rate_plan(p_property_id uuid, p_id uuid, p_code text, p_name text, p_is_corporate boolean, p_cancellation_type text, p_cancellation_value numeric, p_no_show_type text, p_no_show_value numeric, p_deposit_type text, p_deposit_value numeric, p_is_active boolean, p_cancellation_free_days integer DEFAULT NULL::integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_id uuid; v_tenant uuid;
begin
  perform app.require('setup.rate.manage', p_property_id);
  if coalesce(btrim(p_code), '') = '' or coalesce(btrim(p_name), '') = '' then
    perform app.fail('E_REQUIRED', 'Code and name are required.'); end if;
  perform app.check_policy('Cancellation policy', p_cancellation_type, p_cancellation_value);
  perform app.check_policy('No-show policy', p_no_show_type, p_no_show_value);
  perform app.check_policy('Deposit policy', p_deposit_type, p_deposit_value);
  if p_cancellation_free_days is not null and p_cancellation_free_days < 0 then
    perform app.fail('E_INVALID', 'Free cancellation days cannot be negative.'); end if;
  select tenant_id into v_tenant from public.properties where id = p_property_id;
  begin
    if p_id is null then
      insert into public.rate_plans(tenant_id, property_id, code, name, is_corporate,
        cancellation_policy_type, cancellation_policy_value, no_show_policy_type, no_show_policy_value,
        deposit_policy_type, deposit_policy_value, is_active, cancellation_free_days)
      values (v_tenant, p_property_id, upper(btrim(p_code)), btrim(p_name), coalesce(p_is_corporate, false),
        p_cancellation_type, coalesce(p_cancellation_value, 0), p_no_show_type, coalesce(p_no_show_value, 0),
        p_deposit_type, coalesce(p_deposit_value, 0), coalesce(p_is_active, true), coalesce(p_cancellation_free_days, 2))
      returning id into v_id;
    else
      update public.rate_plans set code = upper(btrim(p_code)), name = btrim(p_name),
        is_corporate = coalesce(p_is_corporate, false),
        cancellation_policy_type = p_cancellation_type, cancellation_policy_value = coalesce(p_cancellation_value, 0),
        no_show_policy_type = p_no_show_type, no_show_policy_value = coalesce(p_no_show_value, 0),
        deposit_policy_type = p_deposit_type, deposit_policy_value = coalesce(p_deposit_value, 0),
        is_active = coalesce(p_is_active, true), cancellation_free_days = coalesce(p_cancellation_free_days, cancellation_free_days)
      where id = p_id and property_id = p_property_id returning id into v_id;
      if v_id is null then perform app.fail('E_NOT_FOUND', 'Rate plan not found.'); end if;
    end if;
  exception when unique_violation then
    perform app.fail('E_DUPLICATE', 'That rate plan code is already used.');
  end;
  return v_id;
end $function$;

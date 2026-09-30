-- Tax rounding remainder never lands on a 0% tax (found in the step 4 click-through).
--
-- Before: the kobo left over from rounding was added to the last tax line, even when that line was the
-- 0% state levy, so a charge of 7,777.77 showed "State levy -0.01" on the folio and the invoice.
-- After: the remainder goes on the last tax that has a rate. Totals are unchanged.

CREATE OR REPLACE FUNCTION public.calculate_tax(p_property_id uuid, p_amount numeric, p_tax_inclusive boolean DEFAULT false)
 RETURNS TABLE(line_no integer, tax_code text, tax_name text, percent numeric, taxable_base numeric, amount numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  r record;
  v_codes text[] := '{}'; v_names text[] := '{}'; v_pcts numeric[] := '{}'; v_comp boolean[] := '{}';
  v_bases numeric[] := '{}'; v_amts numeric[] := '{}';
  v_mult numeric := 0; v_prev numeric := 0; v_base numeric; v_t numeric;
  v_net numeric; v_target numeric; v_sum numeric := 0; n int; i int; k int;
begin
  if auth.uid() is not null and not app.has_property_access(p_property_id) then
    perform app.fail('E_FORBIDDEN', 'You do not have access to this property.');
  end if;
  if p_amount is null or p_amount < 0 then
    perform app.fail('E_INVALID', 'Amount must be zero or more.');
  end if;

  for r in select t.code, t.name, t.percent, t.compounds_on_previous
           from public.tax_rates t
           where t.property_id = p_property_id and t.is_active
           order by t.sort_order, t.code loop
    v_codes := v_codes || r.code; v_names := v_names || r.name;
    v_pcts := v_pcts || r.percent; v_comp := v_comp || r.compounds_on_previous;
  end loop;
  n := coalesce(array_length(v_codes, 1), 0);
  if n = 0 then return; end if;

  -- tax per 1 unit of net
  for i in 1..n loop
    v_base := 1 + case when v_comp[i] then v_prev else 0 end;
    v_prev := v_prev + v_base * v_pcts[i] / 100;
  end loop;
  v_mult := v_prev;

  if p_tax_inclusive then
    v_net := p_amount / (1 + v_mult);
    v_target := round(p_amount, 2) - round(v_net, 2);
  else
    v_net := p_amount;
    v_target := round(v_net * v_mult, 2);
  end if;

  v_prev := 0;
  for i in 1..n loop
    v_base := v_net + case when v_comp[i] then v_prev else 0 end;
    v_t := v_base * v_pcts[i] / 100;
    v_prev := v_prev + v_t;
    v_bases := v_bases || round(v_base, 2);
    v_amts := v_amts || round(v_t, 2);
    v_sum := v_sum + round(v_t, 2);
  end loop;
  -- Rounding remainder on the last tax that has a rate (a 0% tax must stay at zero).
  k := n;
  while k > 1 and v_pcts[k] = 0 loop k := k - 1; end loop;
  v_amts[k] := v_amts[k] + (v_target - v_sum);

  for i in 1..n loop
    line_no := i; tax_code := v_codes[i]; tax_name := v_names[i]; percent := v_pcts[i];
    taxable_base := v_bases[i]; amount := v_amts[i];
    return next;
  end loop;
end $function$;

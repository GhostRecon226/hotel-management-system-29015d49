-- Plan prices in naira (decision A16, Peter, 12 Oct 2026).
--
-- Monthly prices: Starter 20,000 (launch price), Standard 45,000, Pro 80,000.
-- Yearly prices: ten months for twelve (pay 10, get 12).
-- Enterprise has no price on purpose. It is quoted, so nobody can buy it online (E_NO_PRICE).
-- Amounts are in kobo, the smallest unit. Other currencies already on a plan are kept.
-- Platform staff can still change a price later with platform_set_plan_price.

update public.plans p
   set prices = p.prices || jsonb_build_object(
         'NGN', coalesce(p.prices -> 'NGN', '{}'::jsonb) || jsonb_build_object('month', v.month_kobo, 'year', v.month_kobo * 10))
  from (values ('starter', 2000000::bigint), ('standard', 4500000::bigint), ('pro', 8000000::bigint)) as v(code, month_kobo)
 where p.code = v.code;

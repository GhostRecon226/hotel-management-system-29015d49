-- Read-only hotels can still settle and check out (audit finding M3, decision D6).
--
-- Before: settlement functions (post_payment, request_refund, close_folio, issue_invoice, split_folio,
-- transfer_transaction, open_main_folio) called app.assert_writable(true), which skipped the check,
-- but the table guard app.enforce_writable still blocked their inserts, because only check_out and
-- request_unsettled_checkout switched on the app.settlement flag. Guests were trapped at the desk.
--
-- After: asking assert_writable for settlement switches the flag on for the rest of that request, and
-- later checks in the same request (for example inside app.require) respect it. Only settlement
-- functions pass true, and they do it first, so ordinary bookings and charges stay blocked.

create or replace function app.assert_writable(p_allow_when_read_only boolean default false)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  if app.my_tenant() is null then
    perform app.fail('E_FORBIDDEN', 'You do not have access to a hotel. Ask your administrator.');
  end if;
  if p_allow_when_read_only then
    perform set_config('app.settlement', 'on', true);
    return;
  end if;
  if coalesce(current_setting('app.settlement', true), '') = 'on' then return; end if;
  if not app.tenant_writable(app.my_tenant()) then
    perform app.fail('E_READ_ONLY',
      'Your subscription is expired or suspended, so the hotel is read-only. Settlement and check-out are still allowed.');
  end if;
end $$;

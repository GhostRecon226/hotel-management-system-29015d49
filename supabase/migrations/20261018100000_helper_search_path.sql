-- Fix the search path on 14 helper functions (QA-07, AGENTS rule 4).
-- The security advisor found helpers with no fixed search path. Function bodies do not change.

alter function app.approve_perm(text) set search_path = public, pg_temp;
alter function app.block_audit_change() set search_path = public, pg_temp;
alter function app.block_ledger_change() set search_path = public, pg_temp;
alter function app.check_policy(text, text, numeric) set search_path = public, pg_temp;
alter function app.fail(text, text) set search_path = public, pg_temp;
alter function app.hk_default_checklist(text) set search_path = public, pg_temp;
alter function app.ledger_business_date() set search_path = public, pg_temp;
alter function app.level_rank(character) set search_path = public, pg_temp;
alter function app.profiles_lock_tenant() set search_path = public, pg_temp;
alter function app.rollover_due(public.properties) set search_path = public, pg_temp;
alter function app.room_assignment_same_day() set search_path = public, pg_temp;
alter function app.room_ready(public.rooms) set search_path = public, pg_temp;
alter function app.support_grant_open(public.support_access_grants) set search_path = public, pg_temp;
alter function app.support_status(public.support_access_grants) set search_path = public, pg_temp;

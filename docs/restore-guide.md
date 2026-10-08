# Restore guide

How to rebuild the hotel database from a backup. Written after the restore drill of 8 Oct 2026.

## What the drill proved

- Backup used: `live-2026-10-07-before-guided-setup` (schema, data and roles files).
- The restore finished with no errors in about 2 seconds, into a scratch local database. Practice and live were not touched.
- Row counts matched: reservations 3, folio transactions 11, guests 3, rooms 2, properties 2, tenants 2.
- Money matched: debits ₦402,050, credits ₦11,825, balance ₦390,225 across 3 folios. The folio balance view gave the same totals folio by folio.
- Each hotel's General Manager could read their own dashboard and nothing from the other hotel.

## The trap: restore the strict defaults first

A plain restore comes back **less secure than live**. The new database starts with loose default rights. Each function and table is created with those loose rights, and the backup tightens them only at the end. Result in the drill: signed-out visitors could call 180 functions (including `billing_apply_event`, which only the server may call), and visitors and signed-in users had insert, update and delete rights on all 63 tables.

The backup itself is correct. The order is the problem.

**Fix: before loading the schema and data, run the same default-rights rules our migrations set** (`20260930100000_default_deny_grants.sql`):

```sql
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, public;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, public;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, public;
alter default privileges for role postgres in schema public grant select on tables to authenticated;
alter default privileges for role postgres in schema public grant execute on functions to service_role;
```

With this step the drill showed: visitors can call 0 functions, nobody has table write rights, and every right matched a copy built from the migration files.

## Order of a restore

1. Create the empty database. Never restore over a project that holds data.
2. Load the roles file as the top admin login. A normal login is refused.
3. Run the default-rights rules above.
4. Load the schema, then the data, as one all-or-nothing transaction that stops on the first error.
5. Run the checks below. Do not open the app to staff until all pass.

## Checks after any restore

- Row counts match the backup report.
- Folio balances: debits, credits and balance match the figures taken from the backup before restoring.
- A visitor (signed out) can call no function: the count of functions callable by `anon` is 0.
- No table gives insert, update or delete to `anon` or `authenticated`.
- A General Manager sees only their own hotel's figures.
- "Allow ID photos" is still off on every live hotel.

## Known limits

- **Migration history is not in the backup.** After a real restore, record the applied migrations again before any `db push`, or the next release will try to apply everything. Plan this step with Peter before using it.
- **A backup holds only the state when it was taken.** Anything newer is lost. A backup from before a release will lack that release's functions (the drill backup has no `public.setup_progress`, as expected).
- Live has one helper our migrations do not create, `public.rls_auto_enable()`. It comes from a Supabase project setting and is harmless.
- Supabase Pro daily backups are a separate safety net. Keep our own backup before every live release.

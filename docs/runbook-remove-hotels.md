# Runbook: remove demo hotels

One-time clean-up of demo hotels (PLT-025). The tool is `scripts/remove-hotels.sql`. It is not a migration.

## What it does

- Deletes every row the named hotels own, the hotels, and their staff sign-in accounts.
- Leaves other hotels, the plan list, the permission list and every platform operator alone.
- Lifts the ledger locks for this one transaction only, then puts them back.
- Refuses if a hotel still has ID photo files, if a platform operator is staff of the hotel, or if an id is unknown.
- Rolls everything back if any row of the hotel is left or any row points at something removed.

## Hotels agreed on 13 Oct 2026 (Peter)

| Project | Hotel | Id |
| --- | --- | --- |
| Practice | Practice Hotel Ltd | dfacacd1-8209-4326-ab8a-4059014a825c |
| Live | Euro Bar Hotel (30 Sep 2026) | 299f7487-0704-4fbb-8de0-d4b908d77a29 |
| Live | Euro Bar Hotel (5 Oct 2026) | cde8c474-c2dc-491c-9c26-77cd4d2f2b8e |

The platform operator `chibuzor.opara15@yahoo.com` stays on both.

## Steps (Claude runs these in the Mac session)

1. Practice first. Back up, then run the dry run:

        begin;
        \i scripts/remove-hotels.sql
        select pg_temp.remove_hotels(array['<id>']::uuid[], true);
        rollback;

   It must end with `[E_DRY_RUN]` and print the hotel names and row counts. Show Peter the counts.
2. Real run: the same, with `false`, then `commit;`.
3. Check: the hotel list shows only the hotels left, `/platform` loads, the operator can still sign in.
4. Live only after Peter types "yes, live": backup into `~/hotel-desk-backups`, dry run, show counts, real run, check, link back to practice.
5. Every report starts with "Project: practice" or "Project: live" and ends with the CLI linked to practice.

## After a wipe

Practice has no hotel. Create a fresh test hotel and staff before the 14 Oct dry run.

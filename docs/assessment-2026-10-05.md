# Hotel Desk: full assessment, 5 October 2026

Read-only review. No code, migration, data or setting was changed. No command ran against the live database; the repository stayed linked to the practice project (`vxkresricneodgvqphrn`). Written by Claude Code for Peter, in stages, so each part is saved as it is finished.

How to read it:
- Sizes: S = up to 2 days, M = up to 2 weeks, L = more than 2 weeks.
- Ratings: GREEN = a hotel can rely on it; AMBER = works with gaps; RED = not safe or not usable.
- Every claim names its evidence (file, test, table, function or command). UNVERIFIED marks what I could not check.
- "Code at" means branch `main`, commit `f94222b` (stage 1 and 2 merged and live).

Status of each part: Part 1 done. Part 2 in progress.

---

## Part 1. Health check

### 1.1 Database tests

Command: `scripts/test-db.sh` (local Supabase in Docker, rebuilt from the 45 migrations, then the upgrade test from the live state of 30 Sep).

| Result | Count |
|---|---|
| Checks passed | 648 (619 in 15 test files, plus 29 upgrade checks) |
| Checks failed | 12, all known, none new |

The 12 known failures. "Hotel feels it" means a hotel would notice in normal use.

| # | Test (file) | Root cause in one line | Hotel feels it | Fix size |
|---|---|---|---|---|
| 1 | FO-003 check-in needs the registration card accepted (`13_reservations.sql`) | Check-in has no "guest accepted the registration card" step; `check_in` takes the card details but no acceptance flag. | Yes. Front desk still prints and files a paper card. | S (flag), M (with signature capture) |
| 2 | FO-007 complimentary upgrade keeps the booked rate (`13_reservations.sql`) | No function moves a booking to a better room type while keeping the price; `move_room` re-prices or refuses. | Yes. Upgrades are daily practice. | M |
| 3 | FO-008 an in-house stay can be shortened (`13_reservations.sql`) | `extend_stay` only allows later dates ("must be after ..."). | Yes. A guest who says "I leave tomorrow, not Friday" cannot be changed until check-out. | S |
| 4 | FO-008 shortening removes unused nights (`13_reservations.sql`) | Same cause as 3: nights stay booked until check-out. | Yes. Availability shows the room as taken. | (same fix as 3) |
| 5 | HK-002 a task assigned to nobody cannot be started (`14_lifecycle.sql`) | `start_hk_task` does not check that the task has an assignee. | Slightly. Work can start with no name on it. | S |
| 6 | HK-003 attendant is told about a failed inspection (`14_lifecycle.sql`) | `inspect_hk_task` writes no notification for the attendant. | Yes. The attendant does not know the room must be cleaned again. | S |
| 7 | ROOM-004 a manual "dirty" override needs a reason (`14_lifecycle.sql`) | `set_room_condition` accepts an empty reason. | Slightly. Weaker audit of room status changes. | S |
| 8 | PLT-007 a hotel can add another property (`15_accounts.sql`) | No function creates a second property; the property limit can never apply. | Only hotel groups. | M |
| 9 | PLT-004 a Ghana property uses cedi (`17_more_features.sql`) | `app.seed_property_defaults` seeds Nigerian currency and taxes for every country. | Only outside Nigeria. | S |
| 10 | RES-013 an arrival-ready flag exists (`17_more_features.sql`) | Not built: no flag that says "room, deposit and documents are ready". | Yes, mildly. Front desk checks each arrival by hand. | S |
| 11 | HK-002 an attendant sees only their own tasks (`17_more_features.sql`) | The `hk_tasks` read rule shows every task of the property. | Yes, mildly. Attendants see colleagues' lists. | S |
| 12 | SET-008 inspection can be switched off per property (`17_more_features.sql`) | Every completed task waits for an inspection; there is no property setting. | Yes for small hotels without a supervisor: rooms stay "waiting inspection". | S |

### 1.2 Other checks

| Check | Command | Result |
|---|---|---|
| Browser tests | `npx playwright test` | PASS, 28 of 28 |
| Type check | `npm run typecheck` | PASS |
| Money in browser code | `npm run check:money` | PASS ("no money arithmetic in browser code") |
| Colour contrast | `npm run check:contrast` | PASS (all text pairs meet WCAG AA 4.5:1) |
| Public page blanks | `check:confirm` (only on branch `claude/public-pages`; run in a temporary copy) | FAIL by design: 21 `[TO CONFIRM]` blanks (about 2, contact 4, privacy 8, terms 4, faq 3). That branch cannot build until they are filled. |
| Production build | `npm run build` | PASS, with warnings: 7 uses of the deprecated `createServerFn().inputValidator()` (`src/lib/invite.functions.ts`, `exports.functions.ts`, `id-photos.functions.ts`); Vite says `vite-tsconfig-paths` is no longer needed; the charts library `recharts` adds 561 KB (102 KB compressed) to the server bundle. |
| Known vulnerabilities | `npm audit` | PASS, 0 vulnerabilities |
| Outdated packages | `npm outdated` | 17 behind. Major versions waiting: eslint 10, TypeScript 7, zod 4, recharts 3, lucide-react 1, react-day-picker 10, @vitejs/plugin-react 6. Nitro is a beta build (3.0.260603-beta). None is a security fix. |
| Dependabot alerts | `gh api` | UNVERIFIED. The GitHub command-line tool is not installed on this Mac and the repository is private. Look at: repository > Security > Dependabot alerts. |

### 1.3 Migrations and docs

**Migrations.** The folder has 45 files. The practice project records the same 45, one to one (`supabase migration list --linked`, practice). Live was confirmed at 45 on 7 Oct after the stage 1 and 2 release (fingerprint check). Not re-run today because this task forbids live commands.

**Docs out of date:**

| Doc | What is wrong | Evidence |
|---|---|---|
| `docs/data-model.md` | Lists none of the 36 error codes the database raises (for example `E_ROOM_TAKEN`, `E_ID_PHOTO_REQUIRED`, `E_PLAN_LIMIT`). | `grep app.fail('E_` in migrations gives 36 codes; `grep E_` in the doc gives 0. |
| `docs/decisions.md` | No entries for the 6 Oct decisions: free-text room labels, ID photos, the Allow switch, the 12-month keep period, delete rules. | `grep` for "6 Oct", "ROOM-005", "ID photo" finds nothing. |
| `docs/status-report.md` | The long requirement table (written 30 Sep) still marks DAY-003, DAY-006 and FIN-015 "Missing" although they are built and tested (DAY-003: 14 checks, DAY-006: 23 checks, FIN-015: 6 checks, all passing). The short "fixed" tables in the same file are correct. | Lines about 404, 413, 416 against `14_lifecycle.sql`, `19_same_day.sql`, `12_ledger.sql`. |
| `docs/setup-checklist.md` | Section C (practice project) shows nothing ticked, but the practice project exists with all 45 migrations. Sections A, B, D, G, H are untouched. E: 4 of 11 done; F: 1 of 4. | Tick count per section; practice migration list. |
| `docs/functions.md` | Missing 19 of the 139 browser-callable functions: `add_rooms_named`, `add_rooms_range`, `begin_id_photo_upload`, `finish_id_photo_upload`, `open_id_photo`, `list_id_photos`, `delete_id_photo`, `get_id_photo_settings`, `set_id_photo_settings`, `cancel_subscription`, `checkout_outstanding`, `kpi_summary`, `post_check_out_charge`, `preview_check_out_charge`, `preview_charge`, `preview_reservation_fee`, `require_permission`, `update_my_profile`, `waive_same_day_charge`. Function bodies changed since 30 Sep are also not reflected. | Names in the doc compared with the practice function list. |
| `AGENTS.md` | Says colour tokens live in `src/styles.css` (now `src/theme.css`) and names `/design` as the reference screen (deleted on `claude/public-pages`, still on main). | `AGENTS.md` line 14; `src/theme.css`. |

### 1.4 Requirements against tests

Source: the requirement table in `docs/status-report.md` (113 rows, the copy of the R1 workbook kept with this app). The workbook itself (`hms-reference-backend/docs/HMS_R1_Requirements.xlsx`) could not be parsed by my reader: UNVERIFIED that the two match row for row.

- **Rows with no test tag (14):** ADM-009 exports, DAY-005 night audit gate, FIN-016 cashier shifts, GST-006 feedback, PLT-009 platform staff role, PLT-010 break-glass access, PLT-012 subscription billing, RES-012 groups, RPT-002 live views, RPT-003 figures trace to the ledger, RPT-004 report screens, SET-002 room types, SET-003 room inventory, SET-006 charge codes and payment methods. Of these, SET-002, SET-003, SET-006 and RPT-002 are used by every other test, so they are covered indirectly, not by name.
- **Test tags with no row (1):** DAY-006b (same-day check-out charge, 28 checks in `21_same_day_checkout.sql`). Add a row.
- **Rows marked done that do not work:** none. Every failing test belongs to a row marked "Partly built" or "Missing".
- **Rows marked "Missing" that do work:** DAY-003, DAY-006, FIN-015 (see 1.3).
- **Totals in the table:** 72 built and works, 24 partly built, 9 missing (3 of them wrongly), 8 built but untested.

### 1.5 Security and rule hygiene

The rules below are the 10 rules in `hms-reference-backend/CLAUDE.md`. This repository has no `CLAUDE.md`; its own rules are in `AGENTS.md`. I checked the 10 rules against this app on the practice database (same schema as live).

| Rule | Check | Result |
|---|---|---|
| 1 Never edit a pushed migration | `supabase migration list` shows every local file recorded remotely with the same version; the stage 1 and 2 releases added new files only. | PASS. (A byte-for-byte check of old files against what live ran is not possible from migration history; UNVERIFIED beyond file names.) |
| 2 Every table has `tenant_id` and row-level security | 46 tables; all 46 have row-level security on. 3 have no `tenant_id`: `tenants` (the hotel list itself), `plans` and `permissions` (shared reference lists). | PASS (the 3 are correct by design). |
| 3 Helpers in `app`, callable functions in `public`, only `public` granted | No `app` function is callable by signed-in users (stage checks). | PASS, with one exception: the `btree_gist` extension is installed in `public`, so about 200 of its internal functions (`gbt_*`, `*_dist`) are callable by signed-in users. They read no hotel data. Supabase's linter calls this "extension in public". Fix: move the extension to the `extensions` schema. Size S. |
| 4 Security definer, fixed search path, permission check first | All 139 of our own browser-callable functions are security definer with a fixed search path. 13 do not call `app.can` or `app.require` directly; each one's first step is `app.reservation_for_write(id, 'permission')` or `app.mnt_ticket_for_write`, which check the hotel and the permission (`20260929101000_reservations.sql` line 245). | PASS. |
| 5 Errors through `app.fail`, codes in `docs/data-model.md` | All raised errors use `app.fail`. The doc lists none of the 36 codes. | FAIL on the doc half. Size S. |
| 6 Ledger never updated or deleted | Triggers block UPDATE, DELETE and TRUNCATE on `folio_transactions`, `folio_tax_lines`, `audit_events` (`20261001100000_lock_ledger_and_audit.sql`); tested in `12_ledger.sql` and the upgrade test. | PASS. |
| 7 Every money or stock write takes an idempotency key | `folio_transactions`, `invoices`, `reservations`, `approvals` have `idempotency_key NOT NULL` and a unique (hotel, key) constraint, so the database itself refuses a second row with the same key. 4 browser functions take the key from the screen (`post_charge`, `post_payment`, `apply_discount`, `issue_invoice`); 5 build a fixed key themselves (`room:<booking>:<date>`, `svc:<id>`, `approval:<id>`). The same-day charge makes a fresh key only after a reversal, under a lock on the booking (`app.insert_same_day_charge`). | PASS. No stock or inventory module exists yet. |
| 8 Default-deny grants | Signed-out visitors have no rights on any table. Signed-in users have no insert, update or delete right on any table; they read through row-level security only. `guest_documents` and `guest_document_files` have no read right at all (numbers and photos only through functions). | PASS. |
| 9 Every new function has a test; every requirement has a workbook row | 14 requirement rows have no test tag (1.4). The workbook tool `reqs_data.py` lives only in the reference repo and is not used here. | PARTIAL. The rule does not fit this repo as written. |
| 10 Seed data from `data_perm.py` | Not used here: reference data is seeded inside the migrations. | NOT APPLICABLE to this repo. |

**Secrets in the repository:** none found. A scan of every tracked file for Supabase secret keys, service-role tokens, Resend keys, live payment keys and database passwords found nothing; the only `.env` file tracked is `.env.example` with empty values.

### 1.6 Known leftovers

| Item | State | Evidence |
|---|---|---|
| DAY-006 same-day charge | Built and live: one night charged at check-in for a same-day stay, and at check-out for an overnight stay that leaves on the arrival day (DAY-006b); managers can waive with a reason. The requirement table still says "Missing" (doc only). | `19_same_day.sql`, `21_same_day_checkout.sql` |
| A16 plan tiers and prices | Open. Four plans exist with room, property and user limits (`public.plans`, 4 rows) but no prices and no billing (PLT-012 missing). | practice `plans` count |
| A14 cloud region and data protection advice | Open. The data sits in Ireland (EU); legal advice under the NDPA 2023 is pending; 3 privacy blanks depend on it. | `docs/decisions.md`, privacy blanks |
| A11 tax seed sign-off | Open. Service charge 10% and VAT 7.5% are placeholders until the accountant confirms; `docs/accountant-brief.md` lists the questions. | `docs/accountant-brief.md` |
| Copied roles do not get new permissions | By design: a hotel's copied role keeps the permissions it had. Live has no copied roles today (checked 7 Oct), so nobody is affected yet. No warning on screen when new permissions arrive. | live roles check, 7 Oct |
| Check-in form loses typed data after a reload | Seen once on practice. The form keeps what was typed only in the open page. No draft saving. | practice test, 7 Oct |
| `rls_auto_enable` difference | Live has a Supabase-made event trigger that switches on row-level security for new tables; practice does not. Harmless. | fingerprint diff, 7 Oct |
| Setup checklist A to F | A 0/3, B 0/3 (no own domain yet), C 0/10 ticked (practice project done in fact), D 0/7 (no Resend email yet), E 4/11, F 1/4. | `docs/setup-checklist.md` |
| Email sender every 5 minutes | Off while on Vercel Hobby; booking confirmations and alerts queue and are not sent. | `vite.config.ts`, deployment plan 4.4 |
| Public pages | Built on `claude/public-pages`, not merged; 21 blanks. | check:confirm |
| Vercel Authentication on the long team address | Still on for `...-peters-projects-ee85d5d5.vercel.app`; the short live address is open. | earlier curl checks |

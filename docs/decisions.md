# Decisions log

Newest changes go at the bottom of each row's notes. Date format is day month year.
"State" is the decision's state. Whether the app does it yet is in `docs/status-report.md`.

| Ref | Decision | State | Reason |
|---|---|---|---|
| A1 | Multi-tenant. One product, many hotels. | Confirmed | Hotels sign up themselves by subscription. |
| A2 | Business date rolls automatically in R1. Night audit and cashier shift come in R2. | Confirmed | Keeps R1 small. Audit needs cashier shifts first. |
| A3 | No Company entity. Corporate is a booking source, a free-text company name and a corporate rate plan. | Confirmed | Structured accounts are R2 (BR-024). |
| A10 | Nigeria first. NGN base currency. Multi-currency with recorded FX rate. Payments are taken outside the system. | Confirmed | Avoids a payment licence in R1. |
| A11 | Tax seed: 10% service charge, 7.5% VAT on net plus prior, state levy 0%. | Open | Accountant must confirm. Also confirm cancellation and no-show fees are non-taxable (posted untaxed for now, 30 Sep 2026), and whether a discount reduces tax. |
| A12 | Online only in R1. Client ids and idempotency keys keep offline possible. | Confirmed | Offline mode is R2. |
| A13 | Self-service signup with a 60-day trial, every feature (30 days until 12 Oct 2026). Billing integration is R1b. Pilots are invoiced by hand. | Confirmed 12 Oct 2026 | Speed to first pilot. |
| A14 | Cloud hosting on Supabase. Project `urbpxybyrfjczqbrpdsq` in West EU (Ireland). | Confirmed 30 Sep 2026 | Region chosen. Still get data protection advice before signing a bank or chain. |
| A16 | Plans: Starter up to 20 rooms, Standard 60, Pro 150, Enterprise unlimited. Monthly prices in naira: Starter list 30,000 (launch price 20,000, kept for 12 months for hotels that join before a date Peter sets), Standard 45,000, Pro 80,000, Enterprise quoted. Pay for 10 months, get 12. Every new hotel gets 60 days free (A13). | Confirmed 12 Oct 2026 | Market check 12 Oct 2026: the cheapest Nigerian rival, InnGO, charges 40,000 at entry and hides housekeeping there. Pro stays below rivals until Zikora has a restaurant module, booking engine and channel manager. Review prices after three pilot hotels give their own figures. Entered in the plans table by migration 20261020130000 (PLT-017); Enterprise has no online price. Feature differences by plan (approvals, custom roles, exports in Standard; branches and AI brief in Pro) are the plan, not built. |
| D1 | Adjustments, reversals and refunds always need approval. A discount above the user's limit waits for approval. | Confirmed | Audit trail and control (BR-015). |
| D2 | Approver must differ from requester. Inspector differs from cleaner. Ticket closer differs from resolver. | Confirmed | Separation of duties. |
| D3 | Approval limits have no default. Grant level L with no limit row means 0. | Confirmed | Fail closed. |
| D4 | Room charge idempotency key is `room:<reservation>:<date>`. | Confirmed | Rolling twice cannot charge twice. |
| D5 | A failed date roll notifies managers and changes nothing. | Confirmed | Safe to retry. |
| D6 | Read-only tenants can still settle and check out. | Confirmed | Never trap a guest at the desk. Fixed 30 Sep 2026 (finding M3). |
| D7 | Past due for more than 14 days suspends the tenant. | Confirmed | Grace period before suspension. Built 30 Sep 2026 (daily subscription clock). |
| D8 | First admin gets the System Administrator and General Manager roles. | Confirmed | One person runs a small hotel. |
| D9 | Same-day arrival and departure keeps the dates and deletes the night rows. | Confirmed | Built 1 Oct 2026 with DAY-006. A same-day stay has no night rows, so it does not use up a room for the night in availability. |
| DAY-006 | Same-day arrival and departure is charged one night. A manager can waive the charge with a reason. | Confirmed 30 Sep 2026 | Built 1 Oct 2026. Charged at check-in on the room charge code, same key as the nightly charge (no double charge). Waiver needs `res.rate.override` and a reason. A guest booked overnight who checks in and leaves on the same business day is also charged one night (Peter, 1 Oct 2026; built the same day): it shows on the check-out screen, can be posted early, is posted at check-out if missing, and a manager can waive it with a reason before or after it posts. |
| DAY-005 | The night audit gate stays in R2. Until then the business date rolls on its own and open shifts show only as flags. | Confirmed 8 Oct 2026 | A hard stop could freeze a small hotel when one shift is left open. A timed gate (holds the roll for a set time, then rolls and records what was open) is the R2 design. A warning to night audit users before rollover is optional and not built. |
| Ops | Enable pg_cron. Business date roll every 5 minutes, subscription clock daily at 00:15 UTC. | Confirmed | Both are scheduled by migrations. pg_cron must be enabled on the project. |
| 5a | Unpaid check-out: a holder of the approval permission may check out a guest who owes, with a reason, and it is audited. Everyone else needs a second approver. | Confirmed 30 Sep 2026 | Balances collection against control. |
| 5b | No temporary passwords for invited staff. A "Resend invite" button instead. | Confirmed 30 Sep 2026 | A password shown on screen is weak. |
| 5c | Host the app on Vercel. | Confirmed 30 Sep 2026 | Already in use. |
| 5d | Send email through Resend. | Confirmed 30 Sep 2026 | The outbox code already supports it. |
| 5e | Activate, suspend and change plans by hand for the first pilots (`app.platform_set_subscription`). No platform console yet. | Confirmed 30 Sep 2026 | Faster to first pilot. |
| 5f | Keep the permission names the first build uses (for example `fo.room.move`, `rpt.finance.view`, `setup.rate.manage`). Design documents use these names from now on. | Confirmed 30 Sep 2026 | The code and database already use them. The list is `select key from public.permissions`. |
| 6a | Reservation officers take deposits only, not other payments. | Confirmed 30 Sep 2026 | Matches the original role design. Built 30 Sep 2026, live 1 Oct 2026. |
| 6b | Reservation officers do not see ID documents. | Confirmed 30 Sep 2026 | Data minimisation. Built 30 Sep 2026, live 1 Oct 2026. |
| 6c | Built-in roles can carry approval limits, set per hotel. | Confirmed 30 Sep 2026 | Hotels should not have to copy a role to set a limit. Built 1 Oct 2026: the limit belongs to the hotel's account (all its properties). |
| 6d | Free cancellation defaults to 2 days before arrival, changeable per rate plan. | Confirmed 30 Sep 2026 | Reference design default. Built 30 Sep 2026, live 1 Oct 2026. |

## Deployment decisions (2 Oct 2026)

| # | Decision | Status | Note |
|---|---|---|---|
| D1 | A practice Supabase project for previews and tests, set up before the first pilot. | Confirmed 2 Oct 2026 | Previews never touch live hotel data. |
| D2 | Peter's own domain: app on `app.`, email from `mail.`. | Confirmed 2 Oct 2026 | |
| D3 | Euro Hotel on the live project stays as Peter's demo hotel. | Confirmed 1 Oct 2026 | Keep it active by hand before its trial ends (about 30 Oct 2026). |
| D4 | A second trusted person with access to Vercel, Supabase, Resend and GitHub; two-step sign-in everywhere. | Confirmed 2 Oct 2026 | |
| D5 | Vercel Pro and Supabase Pro. | Confirmed 2 Oct 2026 | Resend free tier for the pilot. |

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
| A13 | Self-service signup with a 30-day trial. Billing integration is R1b. Pilots are invoiced by hand. | Confirmed | Speed to first pilot. |
| A14 | Cloud hosting on Supabase. Project in West EU (Ireland). | Open | Get data protection advice before real guest data. |
| A16 | Plans are configuration. Proposed: starter 20 rooms, standard 60, pro 150, enterprise unlimited. Unpriced. | Open | Peter to pick tiers and prices. |
| D1 | Adjustments, reversals and refunds always need approval. A discount above the user's limit waits for approval. | Confirmed | Audit trail and control (BR-015). |
| D2 | Approver must differ from requester. Inspector differs from cleaner. Ticket closer differs from resolver. | Confirmed | Separation of duties. |
| D3 | Approval limits have no default. Grant level L with no limit row means 0. | Confirmed | Fail closed. Note 30 Sep 2026: built-in roles cannot carry limits, so a hotel copies a role to set one. |
| D4 | Room charge idempotency key is `room:<reservation>:<date>`. | Confirmed | Rolling twice cannot charge twice. |
| D5 | A failed date roll notifies managers and changes nothing. | Confirmed | Safe to retry. |
| D6 | Read-only tenants can still settle and check out. | Confirmed | Never trap a guest at the desk. Fixed 30 Sep 2026 (finding M3). |
| D7 | Past due for more than 14 days suspends the tenant. | Confirmed | Grace period before suspension. Built 30 Sep 2026 (daily subscription clock). |
| D8 | First admin gets the System Administrator and General Manager roles. | Confirmed | One person runs a small hotel. |
| D9 | Same-day arrival and departure keeps the dates and deletes the night rows. | Confirmed | Charge rule still open (DAY-006). Note 30 Sep 2026: this app refuses bookings whose departure is not after arrival. |
| DAY-006 | Same-day stay: charge a night, a day-use rate, or nothing. | Open | Peter to decide. |
| Ops | Enable pg_cron. Business date roll every 5 minutes, subscription clock daily at 00:15 UTC. | Confirmed | Both are scheduled by migrations. pg_cron must be enabled on the project. |
| 5a | Unpaid check-out: a holder of the approval permission may check out a guest who owes, with a reason, and it is audited. Everyone else needs a second approver. | Confirmed 30 Sep 2026 | Balances collection against control. |
| 5b | No temporary passwords for invited staff. A "Resend invite" button instead. | Confirmed 30 Sep 2026 | A password shown on screen is weak. |
| 5c | Host the app on Vercel. | Confirmed 30 Sep 2026 | Already in use. |
| 5d | Send email through Resend. | Confirmed 30 Sep 2026 | The outbox code already supports it. |
| 5e | Activate, suspend and change plans by hand for the first pilots (`app.platform_set_subscription`). No platform console yet. | Confirmed 30 Sep 2026 | Faster to first pilot. |
| 5f | Keep the permission names the Lovable build uses (for example `fo.room.move`, `rpt.finance.view`, `setup.rate.manage`). Design documents use these names from now on. | Confirmed 30 Sep 2026 | The code and database already use them. The list is `select key from public.permissions`. |

# Roadmap: the one page

Last updated 11 Oct 2026. This is the first page to open. It says what is done, what is in progress and what is left. Each line points to the file that holds the detail. When something changes, change it here first.

Where the detail lives:

- Requirements and their status: `docs/requirements.csv` (the register; `docs/HMS_R1_Requirements.xlsx` is built from it).
- Decisions: `docs/decisions.md`.
- Ideas we chose to do later: `docs/backlog.md`.
- Faults we know about: `docs/known-issues.md`.
- QA audit of 10 Oct 2026: `Zikora_QA_Audit_2026-10-10.xlsx` (outside the repository).
- Dry run steps: `docs/pilot-dry-run.md`.
- Setup and launch steps: `docs/setup-checklist.md`, `docs/deployment-plan.md`.

## 1. Done

- 148 of 154 R1 requirements are built and tested. The other 6 are listed in section 3.
- QA audit: the browser test list is finished (13 screens, cashier shift, housekeeping, maintenance, approvals with two users, group bookings, reports, service requests, Setup). QA-15, QA-16, QA-23 and QA-19 (change password) are fixed. QA-20 needs no change.
- Phone layout: tests at 390px wide found and fixed two faults (Front Desk tabs and the off-screen Check in button).
- Load more on long lists (PAG-001, QA-22), the top-bar search (SRC-001) and one rule for money collected (RPT-009) are built and merged (11 Oct 2026). The first two have migrations that practice does not have yet.
- Offline mode stages 1 and 2 are built and merged (11 Oct 2026): saved lists readable with no connection, and charges, payments and housekeeping updates wait on the device and send when the connection returns. Register rows OFF-001 to OFF-004.
- Offline stage 3a (13 Oct 2026, open PR): check-out and room moves wait on the device too (OFF-005, OFF-006). Check-in and walk-in are stage 3b.
- Practice database is current with main (81 migrations, applied 11 Oct 2026). Live is at 77.

## 2. In progress (this week)

| Item | Who | State |
|---|---|---|
| Offline docs, public page wording and register rows (this change) | Peter merges | Open |
| Test hotel and staff on practice for the 14 Oct dry run | Peter, with Claude | Not started. Practice has one hotel, one admin, 2 rooms. |
| Dry run of one hotel day (`docs/pilot-dry-run.md`) | Peter and a second person | 14 Oct 2026 |
| Fixes from the dry run | Claude | Keep a day free after the run |

## 3. Left to build

### Before the first pilot hotel
Nothing blocks the pilot in code, and the optional polish list is finished (Load more on long lists, top-bar search, one "money collected" rule). New ideas go in `docs/backlog.md`.

### Before the first paying hotel
| Item | Owner | Source |
|---|---|---|
| Switch billing on (Paystack key, webhook) and show prices on the pricing page | Peter and Claude | A16 prices entered, PLT-017 |
| Billing integration (pilots are invoiced by hand until then) | Claude | decision A13 (R1b) |
| Tax rates signed off, plus how fees and discounts are taxed | Accountant | decision A11, QA-04 |
| Email sending: Resend key and sender domain | Peter | QA-02 |
| Vercel Pro (turns the 5-minute email job back on), Supabase Pro | Peter | decisions D5 |
| Sentry, UptimeRobot, GitHub Pro | Peter | `docs/safety-net.md` |
| CRON_SECRET in Vercel, live Supabase Site URL | Peter | QA-13, QA-03 |
| Legal pages (13 placeholders), then switch off the Vercel build override | Peter and counsel | QA-24, backlog |

### Not built, by choice (R2 or later)
| Item | Why it waits | Source |
|---|---|---|
| Work without internet, then sync | Large. See section 4. | decision A12 |
| Night audit gate (stop the roll while a shift is open) | A hard stop could freeze a small hotel | DAY-005 |
| Overbooking allowance | Changes how rooms are sold; no pilot hotel has asked | SET-002, QA-17 |
| Company accounts as a real record | Corporate is a booking source and a free-text name for now | decision A3 |
| Daily owner summary by email | Needs email first | backlog |
| Property photo, weather, "up 12%" on the dashboard | Nice to have | backlog |
| Photos on damage reports and service requests | Maintenance tickets are done | backlog |
| Google sign-in, dark theme | Nice to have | QA-19 |
| SMS and WhatsApp messages | Screens say not available yet | QA-20 |

## 4. Open decisions for Peter

| Decision | Recommendation |
|---|---|
| Switch billing on (Paystack key, webhook). Day 61 is built (PLT-018): the hotel moves to its plan and has 14 days to pay. | Do before signup opens to the public. Pilots stay free: set them to Active first. |
| Overbooking allowance (QA-17) | Skip for the pilot. |
| Offline stage 3b (check-in, walk-in) | Peter chose to build stage 3 on 12 Oct 2026. 3a (check-out, room moves) is built. 3b waits on one decision: a queued check-in would keep the guest's ID number on the device until it sends, which the design forbids. The downtime pack (`/downtime`) covers longer outages. |
| Tax treatment of fees and discounts (A11) | Accountant decides. |

## 5. Offline mode, in plain terms

- Stages 1 and 2 are built. A signed-in device keeps reading its last loaded lists with no connection, and charges, payments and housekeeping updates wait and send on return. Sign-in itself and everything else still need internet. A printable downtime pack covers longer outages.
- Stage 3 is not built.
- Stages, smallest first (1 and 2 done):
  1. Keep the last-loaded lists (arrivals, in house, room board) readable when the connection drops. Small to medium. No new risk.
  2. Queue simple actions offline (charge, payment, housekeeping status) and send them when the connection returns. Medium to large. Safe for money because every money write already has an idempotency key.
  3. Full offline for check-in, check-out and room moves. Large. Hard part: two devices can promise the same room while both are offline, so the app needs rules for who wins.
- My advice: ask the pilot hotels how often the connection drops during a shift, and whether stage 3 is needed.

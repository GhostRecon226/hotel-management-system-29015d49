# Roadmap: the one page

Last updated 13 Oct 2026. This is the first page to open. It says what is done, what is in progress and what is left. Each line points to the file that holds the detail. When something changes, change it here first.

Where the detail lives:

- Requirements and their status: `docs/requirements.csv` (the register; `docs/HMS_R1_Requirements.xlsx` is built from it).
- Decisions: `docs/decisions.md`.
- Ideas we chose to do later: `docs/backlog.md`.
- Faults we know about: `docs/known-issues.md`.
- Full audit of 12 Oct 2026 and the kitchen, store and audit scope: Claude Docs, shared by Peter.
- Dry run steps: `docs/pilot-dry-run.md`.
- Setup and launch steps: `docs/setup-checklist.md`, `docs/deployment-plan.md`.

## 1. Done

- 169 of 171 R1 requirements are built and tested (1 is database only, 1 has a known limit). The other 2 are in section 3.
- Practice and live databases are both at 88 migrations (the newest, the platform summary, applied 13 Oct 2026).
- Day 61 after the trial (PLT-018): the hotel moves to the cheapest plan that fits, has 14 days to pay, then becomes read-only. Plan prices are entered (Starter ₦30,000, Standard ₦45,000, Pro ₦80,000 a month; yearly is 10 months).
- Offline mode stages 1, 2, 3a and 3b: saved lists readable with no connection, and charges, payments, housekeeping, check-out, room moves and check-in wait on the device and send when the connection returns. An ID number typed offline stays on the device only until it is sent. Walk-in is not built.
- Website: the contact form sends through the server (PLT-019, needs the Resend key to start sending), security headers on every page (PLT-020), and a web app manifest so Zikora can be added to a phone home screen (PLT-021).
- Owner summary at the top of the platform console (PLT-024): hotels by status, new hotels this week and month with a change on the week before, trials ending within 14 days, hotels gone quiet, and the monthly list price of Active hotels. Account data only. Merged 13 Oct 2026.
- Home page weight (PLT-023): the first page load went from 823 KB to 456 KB of script (243 KB to 142 KB compressed). CI fails a build that goes over the limit.
- QA audit, phone layout fixes, Load more on long lists, top-bar search and one rule for money collected are done.
- Full audit of what is built, in progress and outstanding was written on 12 Oct 2026.

## 2. In progress (this week)

| Item | Who | State |
|---|---|---|
| Test the staff screens on a real iPhone and an Android phone, including Add to Home Screen and an ID photo | Peter | Not started |
| Test hotel and staff on practice for the 14 Oct dry run | Peter, with Claude | Not started |
| Dry run of one hotel day (`docs/pilot-dry-run.md`) | Peter and a second person | 14 Oct 2026 |
| Fixes from the dry run | Claude | Keep a day free after the run |
| Questions to the pilot hotel on kitchen and store | Peter sends | Draft ready |
| Tax questions to the accountant | Peter sends | Draft ready |
| Legal pack to counsel | Peter sends | Draft ready |
| Error and uptime monitoring (Sentry, UptimeRobot) | Peter | Not started |

## 3. Left to build or settle

### Before the first pilot hotel
Nothing blocks the pilot in code. New ideas go in `docs/backlog.md`.

### Before the first paying hotel
| Item | Owner | Source |
|---|---|---|
| Switch billing on (Paystack key, webhook). Until then payment is arranged by email to hello@zikorahq.com | Peter and Claude | PLT-017, A13 |
| Tax rates signed off: service charge 10%, VAT 7.5%, levy 0% are unverified. Also fees, discounts, and tax on food and drink | Accountant | A11 |
| Email sending: Resend key and sender in Vercel (also starts the contact form). Resend is on the Free plan, 30 emails an hour | Peter | QA-02 |
| Vercel Pro (turns the 5-minute email job back on), Supabase Pro and backups check | Peter | D5 |
| Sentry, UptimeRobot, GitHub Pro | Peter | `docs/safety-net.md` |
| CRON_SECRET in Vercel, live Supabase Site URL | Peter | QA-13, QA-03 |
| Confirm hello@zikorahq.com is a real mailbox | Peter | audit |
| Legal pages (14 stand-ins, Terms section 4, the FAQ offline answer), then switch off the Vercel build override | Peter and counsel | QA-24 |
| Sign-up controls: open sign-up has no CAPTCHA | Peter decides | audit |
| Full script policy (CSP) | Claude, after phone tests | audit |

### Asked for by a pilot hotel (not built)
| Item | Size | State |
|---|---|---|
| Store and stock (items, receive, issue, counts, variances) | About 1 week | Scoped. Waits for the hotel's answers. |
| Restaurant and point of sale (orders, kitchen tickets, room charge or pay at table) | About 2 weeks | Scoped. Waits for the hotel's answers. |
| Night audit and stock audit upgrades | A few days | Scoped. |

### Not built, by choice (R2 or later)
| Item | Why it waits | Source |
|---|---|---|
| Offline walk-in | Needs a new guest made on the device (client ids, a database change) | decision A12 |
| Night audit gate (stop the roll while a shift is open) | A hard stop could freeze a small hotel | DAY-005 |
| Overbooking allowance | Changes how rooms are sold; no pilot hotel has asked | SET-002, QA-17 |
| Company accounts as a real record | Corporate is a booking source and a free-text name for now | decision A3 |
| Daily owner summary by email | Needs email first | backlog |
| Recipes, batches and expiry, supplier orders, room service | After store and restaurant | scope doc |
| Property photo, weather, "up 12%" on the dashboard | Nice to have | backlog |
| Photos on damage reports and service requests | Maintenance tickets are done | backlog |
| Google sign-in, dark theme | Nice to have | QA-19 |
| SMS and WhatsApp messages | Screens say not available yet | QA-20 |

## 4. Open decisions for Peter

| Decision | Recommendation |
|---|---|
| Demo hotels (two Euro Bar Hotel records) and pilot hotels: set to Active, or let day 61 run. First warnings land 23 Oct and 28 Oct. | Set demo and pilot hotels to Active. |
| Build kitchen, store and restaurant, and in what order | Ask the pilot hotel the 8 questions first. Store first, then restaurant. |
| Offline walk-in | Ask the pilot hotels how often the connection drops. The downtime pack (`/downtime`) covers longer outages. |
| Open sign-up controls (CAPTCHA, or close sign-up until launch) | Decide before launch on 28 Oct. |
| Fix the last-room test so it runs on any machine | Needs Peter's yes, because it changes an existing test. I show before and after. |
| Make the offline check-in browser test stand alone (`e2e/offline-stage3.spec.ts`, "a check-in entered with no connection") | Known limit, not a fault in the app. Run alone it fails, even on main; in the full suite it passes. Leave as is for the pilot. A fix changes an existing test, so it needs Peter's yes, with before and after. |
| Overbooking allowance (QA-17) | Skip for the pilot. |

## 5. Offline mode, in plain terms

- Built: a signed-in device keeps reading its last loaded lists with no connection. Charges, payments, housekeeping updates, check-out, room moves and check-in wait on the device and send when the connection returns. Every money write has an idempotency key, so a repeat never posts twice.
- Not built: walk-in, sign-in itself, and everything else not listed above. They still need internet.
- A printable downtime pack covers longer outages.

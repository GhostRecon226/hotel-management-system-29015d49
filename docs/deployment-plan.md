# Deployment plan: Hotel Desk, from your Mac to a live address

Written 1 Oct 2026 for Peter's review. Nothing in this plan has been done yet. Each step says who does it. You approve the plan before any step starts, and the merge to `main` and the first live deploy each need their own yes.

## Where things stand today

- **Database (Supabase project `urbpxybyrfjczqbrpdsq`, West EU, Ireland):** all 43 migrations applied and recorded. Both scheduled jobs are active. The hand test passed on it: room type, room, rate plan, booking, check-in and a charge whose tax preview matched the folio.
- **App:** runs on your Mac only (`npm run dev`, port 8080). The production build for Vercel works today (`npm run build` creates `.vercel/output`), and the browser files contain no server-only key.
- **Code:** `main` on GitHub holds the current app (the redesign merged 2 Oct 2026). Vercel deploys every push: `main` goes live, every other branch gets a preview address.
- **Tests:** 539 database checks (527 pass, 12 known failures), 29 upgrade checks, 6 browser tests.

## 1. Hosting on Vercel (decision 5c)

| Step | Who | Detail |
|---|---|---|
| 1.1 | You | Create a Vercel account and a team. Use the **Pro** plan: Vercel's free Hobby plan does not allow commercial use. |
| 1.2 | You | In Vercel, import the GitHub repo `GhostRecon226/hotel-management-system-29015d49`. Framework preset: Other. Build command: `npm run build`. Install command: `npm ci`. Leave the output setting empty (the build writes Vercel's own format). |
| 1.3 | You | Settings > Functions > Region: **Dublin (dub1)**, next to the database in Ireland. Every page and server function talks to the database, so this matters for speed. |
| 1.4 | You | Settings > Git > Production branch: `main`. Every other branch gets a private preview address. |
| 1.5 | Claude | Add `vercel.json` only if the first preview needs it (region and Node version are the likely settings). Test the preview build. |

**Previews and the database.** A preview deploy runs the branch's code. If its keys point at the live database, a half-finished change could write to real hotels' data. I recommend a second, small Supabase project for previews and testing (see decision D1 below).

## 2. Environment keys

Keys are entered by you in the Vercel dashboard (Settings > Environment Variables), never in chat and never in git. For each one, choose which environments get it.

| Key | Secret? | Where it is used | Production value |
|---|---|---|---|
| `VITE_SUPABASE_URL` | No | Browser and server | `https://urbpxybyrfjczqbrpdsq.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | No (public by design) | Browser | Supabase > Project Settings > API Keys > publishable key |
| `VITE_SUPABASE_PROJECT_ID` | No | Browser | `urbpxybyrfjczqbrpdsq` |
| `SUPABASE_URL` | No | Server functions | same as `VITE_SUPABASE_URL` |
| `SUPABASE_PUBLISHABLE_KEY` | No | Server functions | same publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes. Mark "Sensitive".** | Server only: staff invites, exports, email outbox | Supabase > API Keys > secret key. Never in a `VITE_` key. |
| `RESEND_API_KEY` | **Yes. Mark "Sensitive".** | Server only: email outbox | Resend > API Keys, "sending access" only |
| `OUTBOX_FROM_EMAIL` | No | Server only | for example `Hotel Desk <no-reply@mail.yourdomain>` |
| `CRON_SECRET` | **Yes. Mark "Sensitive".** | Server only: protects the scheduled jobs: the daily ID photo clean-up (needed as soon as ID photos go live) and the email sender (step 4.4) | a long random value Vercel can generate |

Rules that stay in force:
- `VITE_` keys reach the browser. Only the publishable key may ever start with `VITE_`.
- `.env.local` on your Mac stays git-ignored. The live keys live only in Vercel and Supabase.
- If a secret key is ever pasted anywhere by mistake, rotate it in Supabase or Resend the same day, then update Vercel.
- Two people should be able to reach the Vercel, Supabase and Resend accounts (you plus one trusted person), with two-factor sign-in on all three.

## 3. Custom domain

| Step | Who | Detail |
|---|---|---|
| 3.1 | You | Choose the domain (decision D2). Suggested shape: the app on `app.yourdomain`, email from `mail.yourdomain`. |
| 3.2 | You | Vercel > Domains > add `app.yourdomain`. At your domain registrar, add the record Vercel shows (usually a CNAME to Vercel). HTTPS is automatic. |
| 3.3 | You | Supabase > Authentication > URL Configuration: Site URL `https://app.yourdomain`. Redirect URLs: `https://app.yourdomain/**`, plus the preview address pattern if previews use this project. |
| 3.4 | Claude | Check sign-up confirmation, sign-in, staff invite and resend-invite links all land on the live address, not `localhost`. The app builds those links from the address in use, so no code change is expected. |

## 4. Email through Resend (decision 5d)

Two kinds of email leave the system, and both should come from your domain.

| Step | Who | Detail |
|---|---|---|
| 4.1 | You | Create a Resend account. Add the domain `mail.yourdomain` and add the DNS records Resend shows (SPF, DKIM, and a DMARC record). Wait for "Verified". |
| 4.2 | You | **Sign-up and invite emails (Supabase Auth).** Supabase > Authentication > SMTP: host `smtp.resend.com`, port 465, user `resend`, password = a Resend API key. Sender `no-reply@mail.yourdomain`. Supabase's built-in email sender allows only a few emails per hour, so without this, sign-ups and staff invites will fail as soon as a few people use them. |
| 4.3 | You | Put `RESEND_API_KEY` and `OUTBOX_FROM_EMAIL` in Vercel (section 2). |
| 4.4 | Built 2 Oct 2026, schedule off for now | **Scheduled sender for app emails (booking confirmations, approval alerts).** `GET /api/cron/outbox`. The 5-minute schedule is switched off while we are on Vercel Hobby, which rejects it. Emails queue in the database and are never lost; they wait until the schedule is back. **To put it back when we move to Pro:** in `vite.config.ts`, restore the commented `vercel: { config: { ... crons ... } }` line inside `nitro({ ... })`, and check `CRON_SECRET`, `RESEND_API_KEY` and `OUTBOX_FROM_EMAIL` are set in Vercel. |
| 4.6 | Built 7 Oct 2026 | **Daily ID photo clean-up.** `GET /api/cron/id-photo-cleanup`, called by Vercel Cron once a day at 02:00 UTC (allowed on Hobby). It removes from storage the ID photos past the keep period and those marked when a guest is anonymised. It refuses every call until `CRON_SECRET` is set in Vercel. |
| 4.5 | Claude | Send a test confirmation and an invite to an address you choose, and check they arrive, are not marked as spam, and their links work. |

## 5. Automatic checks before anything reaches `main`

| Step | Who | Detail |
|---|---|---|
| 5.1 | Claude | A GitHub Actions workflow on every push and pull request: install, type check, money check, start a local Supabase, run the database tests and the upgrade test, run the browser tests, build. |
| 5.2 | You | GitHub > Settings > Branches: protect `main`. Require a pull request and passing checks. No direct pushes. |
| 5.3 | Both | Database migrations stay manual: I list them, you say yes, I apply them with a dry run first, as we have done. The live deploy never changes the database by itself. |
| 5.4 | You | Disconnect the Lovable two-way GitHub sync, so nothing else writes to the repo. |

## 6. Order of work

1. You approve this plan and answer decisions D1 to D5.
2. You create the Vercel, Resend and domain accounts (sections 1, 3, 4) and enter the keys (section 2).
3. I build the scheduled email sender (4.4) and the automatic checks (5.1), test first, on the branch.
4. A preview deploy of the branch, pointed at the preview database (D1). You and I click through it.
5. You say yes to the merge. I open a pull request from `claude/audit-status-report` to `main`; the checks must pass; you merge it.
6. Vercel deploys `main` to `app.yourdomain`. I repeat the hand test there, and test sign-up, invite and password emails.
7. You work through the checklist in section 7. Only then does the first real hotel sign up.

## 7. What must be true before the first real hotel signs up

**Blocking:**
- [ ] **Tax rules confirmed by your accountant (A11).** Today's service charge 10% and VAT 7.5% are placeholders. Also confirm whether cancellation, no-show and same-day fees are taxed.
- [ ] **Password reset works.** It is not built. A staff member who forgets their password is locked out today. (Build item, small.)
- [ ] **Emails arrive from your domain** (section 4): sign-up confirmation, staff invite, password reset, booking confirmation.
- [ ] **Supabase on a paid plan, with daily backups.** Free projects pause after a week without use and have no backups you can restore. Check your plan in Supabase > Billing.
- [ ] **Data protection.** Advice under Nigeria's data protection law (A14) before real guest data goes in, a privacy notice and terms of use the hotel accepts at sign-up, and a named person who answers data requests.
- [ ] **The live address passes the hand test** (step 6), including a check-out with payment.
- [ ] **Error alerts.** The app has no error reporting of its own. Turn on Vercel's logs and alerts at minimum, so a failing page reaches you before a hotel tells you.
- [ ] **How a pilot is activated** (decision 5e), written down: who runs it, with what reason, and how the subscription history is checked.

**Should be done for the pilot, small each:**
- [ ] Attendants see only their own tasks, and a task with nobody assigned cannot be started (HK-002, two of the 12 failures).
- [ ] Inspection can be switched off for a small hotel (SET-008).
- [ ] A reason is required when a room is marked dirty by hand (ROOM-004).
- [ ] The attendant is told when their room fails inspection (HK-003).

**Can wait until after the first pilot:** second property (PLT-007), Ghana currency (PLT-004), shorten a stay in advance (FO-008), complimentary upgrade (FO-007), registration card step (FO-003), arrival-ready flag (RES-013), the rare first-load "hydration mismatch" on the sign-in page.

## Decisions for you

Five decisions, in plain business terms. Number 3 is already settled.

### 1. One live system, or a live system plus a practice copy?
- **The question:** before any change reaches your hotels, should it first run on a separate practice copy of the system (a second, small database), or go straight to the live one?
- **My recommendation:** have a practice copy. Every change is tried there by you and me before it reaches a real hotel, and a half-finished change can never touch real guests or real money.
- **If you decline:** previews would have to use the live database, so any test booking or charge made while checking a change would sit among real hotels' records for good (the ledger cannot be deleted). The alternative is to skip previews and test only after a change is live, which means mistakes are found by hotels instead of by us.
- **Cost:** a second small database; check Supabase's current price.

### 2. The web address
- **The question:** what address will staff type to open the system, and which address will emails come from?
- **My recommendation:** a domain you own, with the system on `app.` (for example `app.yourbrand.com`) and emails from `mail.` (for example `no-reply@mail.yourbrand.com`). Owning it means you can move hosting later without changing what staff use.
- **If you decline:** the system would live on a free Vercel address (something like `hotel-desk.vercel.app`) and emails would come from a generic sender. Both look less trustworthy to hotels and guests, emails are more likely to land in spam, and changing the address later means retraining every hotel and updating every bookmark.

### 3. Your test data on the live system (settled: keep Euro Hotel as your demo hotel)
- **Decision:** Euro Hotel stays as your demo hotel, with the hand-test booking RES-000001 and its ₦11,825 charge.
- **What this means:** no other hotel can see it, and you can use it to show prospects the system. Its 30-day trial clock runs like any hotel's; I will keep it active by hand, using the pilot activation step (5e), so it is never switched to read-only.

### 4. Who else can get into the accounts behind the system
- **The question:** besides you, should one trusted person also have access to the hosting (Vercel), the database (Supabase) and the email service (Resend)?
- **My recommendation:** yes, one person, with two-step sign-in on all three accounts, and both of you able to reset keys.
- **If you decline:** if you are unreachable, or lose your phone or password, nobody can fix an outage, renew a payment or stop a leaked key, and the hotels would be stuck until you are back.

### 5. Paid plans
- **The question:** do we pay for the hosting and database plans meant for businesses?
- **My recommendation:** yes for both. Vercel Pro is required for any commercial use and is needed to send emails every 5 minutes. Supabase Pro gives daily backups you can restore and stops the database being paused when it is quiet. Resend's free tier is enough for a pilot's email volume.
- **If you decline:** Vercel's free plan is not allowed for a paid service and only allows one scheduled run a day, so booking confirmations would go out once a day. On Supabase's free plan the database pauses after a quiet week (the system goes offline until someone wakes it), and there is no backup to restore if data is lost.
- **Cost:** check each site's current price before signing up.

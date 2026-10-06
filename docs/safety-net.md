# Safety net: error alerts, uptime alert, automatic checks

Wave 2, item 1 (6 Oct 2026). Three outside tools tell us when something is wrong, and GitHub checks every change before it is merged. None of them is part of the Vercel build: a failing check or a tool being down never stops a deploy, and Peter can still merge an urgent fix.

## What each part does

| Part | Tool and plan | What it does |
|---|---|---|
| Error alerts | Sentry, Developer plan (free), EU region | Emails Peter when the app or a server function fails in a new way in production. Expected refusals ("a deposit is required") are not sent. |
| Uptime alert | UptimeRobot, Free plan | Opens the live sign-in page every 5 minutes and emails Peter if it is down or shows the error page. |
| Automatic checks | GitHub Actions, included minutes | On every pull request: typecheck, money, contrast and register checks, build, database tests and browser tests, on a scratch database. |
| Branch protection | GitHub Pro, about $4 a month | Main only takes a change whose two checks passed. Peter, as owner, can still override for an urgent fix. |

## Peter's click steps, in order

No step needs a key in chat. Where a value is needed, it goes straight into Vercel or GitHub settings.

### 1. GitHub: make sure checks can never cost money
1. GitHub, your profile picture, Settings, Billing and plans. Check there is no payment method, or that the GitHub Actions spending limit is $0. Then the checks stop when the free minutes run out (2,000 a month on Free, 3,000 on Pro) instead of charging.
2. The repository, Settings, Actions, General: "Allow all actions and reusable workflows" (usually already on).

### 2. GitHub: add the checks file, then open the pull request
GitHub does not let the Mac's access token add files that run automatically, so you add this one file in the web editor. Claude gives you its full contents to copy.
1. Open the repository on github.com. Top left, click the branch menu (it shows `main`) and choose **claude/safety-net**.
2. Click **Add file**, then **Create new file**.
3. In the name box type exactly `.github/workflows/ci.yml`. GitHub turns each `/` into a folder as you type.
4. Paste the contents into the large box.
5. Click **Commit changes...**. In the window, keep "Commit directly to the `claude/safety-net` branch" selected, write the message `Add GitHub checks (CI)`, and click **Commit changes**.
6. GitHub now offers "Compare & pull request" for `claude/safety-net` (or use Pull requests, New pull request, base `main`, compare `claude/safety-net`). Click **Create pull request**. Do not merge.
7. The checks start by themselves. Claude shows you the first run before you merge.

### 3. Sentry: create the account and project
1. Sign up at sentry.io. When asked for the data region, choose **EU** (stored in Germany).
2. Create a project. Platform: React. Name: hotel-desk. Skip the "install the SDK" steps: the app already has its own small reporter.
3. Project Settings, Security & Privacy. Turn **on**: "Data Scrubber", "Use Default Scrubbers", "Prevent Storing of IP Addresses".
4. Session Replay: nothing to turn on. The app never records sessions (there is no replay code), so leave it off.
5. Alerts: keep the default rule that emails you when a new issue appears.
6. Project Settings, Client Keys (DSN): copy the DSN. Do not paste it into chat.

### 4. Vercel: add the DSN (Production only)
1. Vercel, the hotel-management-system project, Settings, Environment Variables.
2. Add `VITE_SENTRY_DSN` with the DSN, environment **Production** only.
3. Add `SENTRY_DSN` with the same DSN, environment **Production** only.
4. Previews and local runs have no DSN, so they never send anything.

### 5. Merge the pull request
Merge only after you have seen the first run. The next production deploy turns error alerts on.

### 6. Check that error alerts arrive
1. Wait until Vercel shows the production deploy of the merge as Ready.
2. Sign in to the live app as System Administrator (or General Manager): `https://hotel-management-system-29015d49.vercel.app`.
3. Setup, Property, scroll to "Error alerts", click **Send a test error**. The app says two test errors were sent. Nothing in the hotel changes.
4. Within a minute, Sentry shows two new issues: "Hotel Desk test error, sent on purpose from the browser" and "... from the server". Each sends you one email.
5. If nothing arrives after five minutes: check both Vercel variables are set for **Production**, then redeploy (Vercel, Deployments, the latest, Redeploy), and try again.
6. In Sentry, mark both issues **Resolved**. Pressing the button again later sends them again (Sentry emails only for a new or reopened issue).

### 7. UptimeRobot: the uptime check
1. Sign up at uptimerobot.com.
2. Add New Monitor. Type: **Keyword**. URL: `https://hotel-management-system-29015d49.vercel.app/auth`. Keyword: `Sign in or create an account`. Alert when the keyword is **not** found. Interval: 5 minutes.
3. Alert contact: your email.
4. Use this address, not the longer one with `peters-projects` in it. That one is behind Vercel's own sign-in and would always look "down" to UptimeRobot.

### 8. GitHub Pro and branch protection (after the first run, so the check names exist)
1. Settings, Billing and plans, upgrade to **GitHub Pro** (about $4 a month).
2. The repository, Settings, Branches, Add branch protection rule. Branch name pattern: `main`.
3. Tick "Require status checks to pass before merging" and pick both checks: **Checks and database tests** and **Browser tests**.
4. Leave "Require branches to be up to date before merging" **unticked** (it forces a new run after every unrelated merge).
5. Leave "Do not allow bypassing the above settings" **unticked**. As owner you can then still merge an urgent fix: GitHub shows a "merge without waiting for requirements" box that only you can tick.
6. Save.

## What each tool sees and where it is stored

For the lawyer, A14 and the privacy notice. Supabase (database, Ireland), Vercel (hosting) and Resend (email) are covered in the deployment plan and the privacy notice draft.

| Tool | What it receives | What it never receives | Where it is stored, and for how long |
|---|---|---|---|
| Sentry | For each unexpected error: the error type and message, the code file and line, the page path, whether it happened in the browser or on the server, the time, the app version. Before sending, the app removes emails, phone numbers, ID, passport and account numbers, record ids, sign-in tokens, keys and anything after `?` or `#` in addresses. For errors in a staff member's browser, Sentry also sees the browser's internet address and browser type while receiving the report; with "Prevent Storing of IP Addresses" on, the address is not stored. | Names, guest or staff details, form contents, bills and amounts linked to a person, cookies, sign-in sessions, screen recordings (no session replay), user identity (no user identification). | Sentry's EU region (Germany). Kept 30 days on the Developer plan. One account: Peter. |
| UptimeRobot | Only what anyone on the internet sees: whether the public sign-in page loads, how fast, and whether the keyword is there. | Any hotel, guest or staff data. It never signs in. | UptimeRobot's servers, under their privacy policy. Holds Peter's email for alerts. |
| GitHub Actions | The source code (already on GitHub) and made-up test data, inside a temporary machine that is deleted after each run. Run logs, and on failure the browser test traces with test pages and fake data. | Real hotel, guest or staff data. Keys or passwords: the checks use a scratch database on the temporary machine and never connect to the practice or live database. | GitHub (United States). Run logs kept up to 90 days; failure traces 7 days. |

## For the lawyer

- **UptimeRobot:** confirm the fair-use policy of 26 May 2026 covers a paid commercial product on the free plan. The policy says "UptimeRobot is available for any use, including commercial and business use, by individuals, teams, and organizations of any size" (https://uptimerobot.com/terms-fair-use/), but the pricing page still describes the free plan as "Good for hobby and non-profit projects" (https://uptimerobot.com/pricing/).
- **Sentry:** confirm the Developer plan terms fit our use: "Customer may access and use the Service only for its internal business purposes" (https://sentry.io/terms/, version 3.0.0, 12 Feb 2024); the pricing page describes the plan as "For solo devs working on small projects" (https://sentry.io/pricing/). We use Sentry's **EU region** (Germany), with IP storage off, no session replay and no user identification.
- Both: whether they belong in the privacy notice's list of service providers, and whether the Sentry EU region needs a transfer note given the database is in Ireland.

## How false alarms and blocked changes are avoided

- **Sentry:** alerts only on a new kind of error, not on every repeat. Expected refusals, network drops, browser extensions and known browser noise are never sent. At most 10 reports per page load, each message once. The free plan stops recording above 5,000 errors a month; it never bills.
- **UptimeRobot:** the keyword check fails on the error page as well as on a dead site. Vercel deploys swap over without downtime. If one blip ever alerts, the next check five minutes later clears it.
- **GitHub checks:**
  - Both checks always run and always report, also when only documentation changed: then they finish in seconds and pass, so a docs-only change is never blocked by a skipped check (`scripts/ci-changes.sh` decides; `docs/requirements.csv` counts as code because the register check reads it).
  - Browser tests get one automatic retry, for a test that fails once and then passes.
  - The Supabase and Node versions are pinned to the ones used here, so a new release elsewhere cannot break the checks overnight.
  - A GitHub or Docker outage can fail a run; re-run it from the pull request page.
  - Vercel never runs these checks. With branch protection, Peter (owner) can override; nobody else can.

## Files

- `src/lib/error-report.ts`: the reporter and its privacy stripping. Tested in `e2e/error-report-unit.spec.ts`.
- Hooked in at `src/start.ts` (server requests and server functions), `src/server.ts` (page errors), `src/lib/outbox-cron.ts` (scheduled jobs) and `src/routes/__root.tsx` (browser).
- `src/lib/test-error.functions.ts` and the "Error alerts" section of Setup, Property: the test-error button (needs `setup.property.edit`). Tested in `e2e/test-error.spec.ts`.
- `.github/workflows/ci.yml`: the two checks. `scripts/ci-changes.sh`: the docs-only test.

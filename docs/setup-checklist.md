# Setup checklist: accounts for going live

Written 2 Oct 2026 after Peter approved decisions 1 to 5 (practice project before the first pilot, own domain, Euro Hotel stays as the demo, a second trusted person with two-step sign-in everywhere, Vercel Pro and Supabase Pro).

How to use this:
- Work top to bottom. Each step is marked **YOU** or **CLAUDE**. Everything here is a YOU step except the last section.
- Menu names below were right when written; the services move things around now and then. If a label differs slightly, look for the nearest match, or ask me.
- **Keys and passwords never go in chat, email or git.** You copy them from one dashboard and paste them straight into another. Keep a copy in a password manager that you and your second person share.
- Nothing here deploys the app or changes the live database. When everything is ticked, send me the short "accounts are ready" message at the end.

## Status on 5 Oct 2026: first live deploy done

- **Live address:** https://hotel-management-system-29015d49.vercel.app, deployed from `main`. Every push to GitHub deploys by itself: `main` goes live, every other branch gets a preview address. No Ignored Build Step.
- **Hand test passed on the live address on 5 Oct 2026** (in a test hotel, Euro Bar Hotel): sign-in, set-up, new guest, booking, check-in, room charge (₦10,000 + ₦1,000 service + ₦825 VAT = ₦11,825), cash payment, check-out, turnover task.
- **Vercel plan: Hobby for now.** The 5-minute email sender is switched off until we move to Pro (see `docs/deployment-plan.md`, step 4.4). Emails wait in the queue and are not lost.
- **Function region: Dublin (dub1).** Checked from the deploy of 5 Oct.
- **Lovable sweep done (2 Oct).** No Lovable package, preset, file or setting is left in the code or in Vercel. You disconnected Lovable from GitHub on 5 Oct.
- **Still open:** the practice Supabase project (C and the Preview keys in E8), so branch previews can load; your own domain (B, E9 to E11); Resend email (D); a check of the repo's GitHub Apps, Webhooks and Deploy keys page for anything left from Lovable.

The steps below were written before going live, when the plan was to keep builds off. Where the live set-up differs, the step says so.

Placeholders: wherever you see `yourdomain.com`, use the domain you buy in step B1. `PRACTICE-REF` is the practice project's ID from step C9.

---

## A. Before you start

- [ ] **A1. YOU.** Pick a password manager both of you will use (for example 1Password or Bitwarden), and create a shared vault called "Hotel Desk".
- [ ] **A2. YOU.** Install an authenticator app on your phone (for example Google Authenticator, Microsoft Authenticator or 1Password). Your second person does the same.
- [ ] **A3. YOU.** Decide who your second person is, and the email address they will use for every account below.

## B. The domain

- [ ] **B1. YOU.** Buy the domain at a registrar (for example Cloudflare, Namecheap, or a `.ng` registrar). Turn on two-step sign-in at the registrar and add your second person if the registrar allows it. Turn on auto-renew.
- [ ] **B2. YOU.** Write these two addresses down; we will use them everywhere:
  - The app: `app.yourdomain.com`
  - Email sender: `mail.yourdomain.com` (emails will come from `no-reply@mail.yourdomain.com`)
- [ ] **B3. YOU.** Find the registrar's DNS page (often called "DNS", "Manage DNS" or "DNS records"). You will add records there in steps D3 and E10. Leave the tab open.

## C. Supabase (database): Pro plan, settings, practice project

- [ ] **C1. YOU.** Sign in at supabase.com. Click your avatar (top right) > **Account preferences** > **Multi-factor authentication** > add your authenticator app.
- [ ] **C2. YOU.** Open your organization (the one holding project `urbpxybyrfjczqbrpdsq`) > **Settings** > **Billing** > **Change subscription plan** > **Pro**. Add the payment card and confirm.
- [ ] **C3. YOU.** Same organization > **Team** > **Invite** > your second person's email, role **Owner** (so they can act if you cannot). Ask them to turn on multi-factor sign-in as in C1.
- [ ] **C4. YOU.** Optional but recommended: organization **Settings** > **Security** > require multi-factor authentication for all members.
- [ ] **C5. YOU.** Live project (`urbpxybyrfjczqbrpdsq`) > **Authentication** > **URL Configuration**:
  - **Site URL:** leave it as `http://localhost:8080` for now. It moves to your domain in step E11, once the site loads there.
  - **Redirect URLs** > **Add URL**: `http://localhost:8080/**` (lets the app on your Mac use password reset and invites).
  - Click **Save**.
- [ ] **C6. YOU.** Live project > **Authentication** > **Sign In / Providers** (or **Providers**) > **Email**: check **Confirm email** is on, set **Minimum password length** to **8** (the app asks for 8), and turn on **Prevent use of leaked passwords** (a Pro feature). Save.
- [ ] **C7. YOU.** Live project > **Database** > **Backups**: check daily backups now show (they start once the plan is Pro). Nothing to click.
- [ ] **C8. YOU.** Create the practice project: organization page > **New project**:
  - Name: `hotel-desk-practice`
  - Region: **West EU (Ireland)**, the same as the live project
  - Database password: click **Generate a password**, then save it in the shared vault. Do not send it to me; I do not need it.
  - Click **Create new project** and wait until it says it is ready.
- [ ] **C9. YOU.** Practice project > **Database** > **Extensions** > search `pg_cron` > turn it on. Then copy the project's ID from the browser address bar (the part after `/project/`, about 20 letters). That is `PRACTICE-REF`. It is not a secret; you can send it to me.
- [ ] **C10. YOU.** Practice project > **Authentication** > **URL Configuration**:
  - **Site URL:** `http://localhost:8080`
  - **Redirect URLs:** `http://localhost:8080/**` and `https://*-YOUR-VERCEL-TEAM.vercel.app/**` (fill in the team name from step E1; the pattern covers every preview address)
  - Save. Then repeat C6 for the practice project.

## D. Resend (email)

- [ ] **D1. YOU.** Sign up at resend.com. Avatar > **Settings** > turn on two-step sign-in. **Settings** > **Team** > invite your second person.
- [ ] **D2. YOU.** **Domains** > **Add Domain** > type `mail.yourdomain.com`, choose region **Ireland (eu-west-1)** so email data stays in the EU like the database > **Add**.
- [ ] **D3. YOU.** Resend now shows several DNS records (usually an MX record, two TXT records for SPF and DKIM, and one for DMARC). In your registrar's DNS page (B3), add each record exactly as shown: same type, name and value. Then in Resend click **Verify DNS Records**. It can take from minutes to a few hours; wait for **Verified** on every line.
- [ ] **D4. YOU.** **API Keys** > **Create API Key**, twice, each with permission **Sending access** and domain `mail.yourdomain.com`:
  - Name `supabase-smtp`: used by Supabase for sign-up, invite and password emails (step D5).
  - Name `vercel-app`: used by the app for booking confirmations (step E8).
  - Each key is shown once. Save both in the shared vault straight away.
- [ ] **D5. YOU.** Live Supabase project > **Authentication** > **Emails** (or **Project Settings** > **Authentication**) > **SMTP Settings** > turn on **Enable Custom SMTP**:
  - Sender email: `no-reply@mail.yourdomain.com`
  - Sender name: `Hotel Desk`
  - Host: `smtp.resend.com`
  - Port: `465`
  - Username: `resend`
  - Password: the `supabase-smtp` key from D4
  - Save.
- [ ] **D6. YOU.** Same project > **Authentication** > **Rate Limits**: set emails per hour to at least **30** (it is very low until custom SMTP is on). Save.
- [ ] **D7. YOU.** Repeat D5 and D6 for the practice project, with sender email `practice@mail.yourdomain.com` so test emails are easy to tell apart.

## E. Vercel (hosting)

Vercel builds and publishes a site every time code reaches GitHub: `main` goes to the live address and every other branch gets its own preview address.

- [ ] **E1. YOU.** Sign up at vercel.com **with GitHub** (the account that owns `GhostRecon226/hotel-management-system-29015d49`). Create a **team** (for example `hotel-desk`) and choose the **Pro** plan. Write down the team's short name; it is used in C10.
- [ ] **E2. YOU.** Avatar > **Account Settings** > **Authentication** > turn on two-step sign-in. Team **Settings** > **Members** > invite your second person as **Owner**, and ask them to turn on two-step sign-in.
- [x] **E3. YOU.** (Done: the project is `hotel-management-system-29015d49`.) Create the project **without deploying**. In the Terminal on your Mac, in the project folder, run these one at a time and follow the prompts (log in, choose your team):
  ```bash
  npx vercel login
  ```
  ```bash
  npx vercel project add hotel-desk
  ```
  This makes an empty project and publishes nothing.
- [x] **E4. YOU.** (Changed 2 Oct: builds are on for every branch, Production Branch `main`, no Ignored Build Step.) In the Vercel dashboard, open project **hotel-desk** > **Settings** > **Git**:
  - **Ignored Build Step**: choose **Don't build anything** (or the closest option that stops all builds). Save. This keeps everything switched off until I ask you to change it.
  - Then **Connect Git Repository** > GitHub > `hotel-management-system-29015d49`.
  - **Production Branch:** `main`.
  - If a deployment starts anyway, open **Deployments**, click it, and choose **Cancel**. Tell me if this happens.
- [x] **E5. YOU.** (Done 2 Oct.) **Settings** > **Build and Deployment**: Framework Preset **Other**, Build Command `npm run build`, Install Command `npm ci`, Output Directory left empty, Node.js Version **22.x**. Save.
- [x] **E6. YOU.** (Done 5 Oct, checked on the live deploy.) **Settings** > **Functions** > **Function Region**: **Dublin, Ireland (dub1)**, next to the database. Save.
- [ ] **E7. YOU.** (Not needed until Vercel Pro, when the email sender is switched back on.) Make the cron key. In Terminal run the command below and copy the long line it prints into the shared vault, labelled `CRON_SECRET (production)`. Run it a second time for `CRON_SECRET (preview)`.
  ```bash
  openssl rand -hex 32
  ```
- [ ] **E8. YOU.** (Production keys done 5 Oct. Preview keys wait for the practice project. `VITE_SUPABASE_PROJECT_ID` is not used by the app and can be skipped. `CRON_SECRET` waits for Pro.) **Settings** > **Environment Variables**. Add each key below. For each one, tick only the environment shown (**Production** = the live site, **Preview** = test addresses). Turn on **Sensitive** where it says so; Vercel then never shows the value again.

  | Key | Production value | Preview value | Sensitive |
  |---|---|---|---|
  | `VITE_SUPABASE_URL` | `https://urbpxybyrfjczqbrpdsq.supabase.co` | `https://PRACTICE-REF.supabase.co` | No |
  | `VITE_SUPABASE_PUBLISHABLE_KEY` | Live project > Project Settings > API Keys > **Publishable key** | same, from the practice project | No |
  | `VITE_SUPABASE_PROJECT_ID` | `urbpxybyrfjczqbrpdsq` | `PRACTICE-REF` | No |
  | `SUPABASE_URL` | same as `VITE_SUPABASE_URL` | same as its Preview value | No |
  | `SUPABASE_PUBLISHABLE_KEY` | same as `VITE_SUPABASE_PUBLISHABLE_KEY` | same as its Preview value | No |
  | `SUPABASE_SERVICE_ROLE_KEY` | Live project > Project Settings > API Keys > **Secret key** | same, from the practice project | **Yes** |
  | `RESEND_API_KEY` | the `vercel-app` key from D4 | the same key | **Yes** |
  | `OUTBOX_FROM_EMAIL` | `Hotel Desk <no-reply@mail.yourdomain.com>` | `Hotel Desk practice <practice@mail.yourdomain.com>` | No |
  | `CRON_SECRET` | `CRON_SECRET (production)` from E7 | `CRON_SECRET (preview)` from E7 | **Yes** |

  Never tick **Development** for these; your Mac uses its own `.env.local`. Only the publishable key may ever be in a key whose name starts with `VITE_`.
- [ ] **E9. YOU.** **Settings** > **Domains** > **Add** > `app.yourdomain.com` > choose **Production**. Vercel shows one DNS record (usually a CNAME with a value ending in `vercel-dns.com`).
- [ ] **E10. YOU.** Add that record in your registrar's DNS page, exactly as shown. Back in Vercel, wait for the domain to show **Valid Configuration**. The address will show an error page until the first deploy; that is expected.
- [ ] **E11. YOU, only once `https://app.yourdomain.com` loads the Hotel Desk sign-in page.** That happens after the first live deploy (step H4), so leave this unticked until then; I will remind you. Switch the live project's web address to your domain:
  - Live project > **Authentication** > **URL Configuration** > **Site URL:** `https://app.yourdomain.com`. **Redirect URLs** > **Add URL:** `https://app.yourdomain.com/**`. Keep `http://localhost:8080/**` in the list. Save.
  - Practice project: no change. Its **Site URL** stays `http://localhost:8080`, and its trusted links stay `http://localhost:8080/**` and the `vercel.app` test-address pattern from C10, so practice emails never point at the live site.
  - Until this step, sign-up and password emails link to `localhost:8080`, which is right while the app only runs on your Mac.

## F. GitHub

- [ ] **F1. YOU.** github.com > avatar > **Settings** > **Password and authentication** > turn on two-factor authentication.
- [ ] **F2. YOU.** Repository > **Settings** > **Collaborators** > add your second person (role Admin).
- [x] **F3. YOU.** (Done 5 Oct. Still to look at: repository > **Settings** > **GitHub Apps**, **Webhooks** and **Deploy keys** show nothing from Lovable.) Disconnect Lovable: github.com > avatar > **Settings** > **Applications** > **Installed GitHub Apps** > **Lovable** > **Configure** > remove this repository (or **Uninstall** if you no longer use Lovable). Also disconnect GitHub in the Lovable project's settings. After this, only you and I change the code.
- [ ] **F4. YOU.** Turn on Dependabot for the app repository: repository > **Settings** > **Advanced Security** (or **Code security**) > turn on **Dependabot alerts** and **Dependabot security updates**. GitHub then emails you when a package the app uses has a known flaw, and opens a proposed fix on a branch. Nothing reaches `main` without your approval.

## G. Tell me the accounts are ready

- [ ] **G1. YOU.** Send me a message like this, with no keys or passwords in it:

  > Accounts are ready. Domain: yourdomain.com (app.yourdomain.com and mail.yourdomain.com). Practice project ref: PRACTICE-REF. Vercel team: TEAM, project hotel-desk, builds switched off. Resend domain verified. SMTP set on both Supabase projects. All keys entered in Vercel. Two-step sign-in on for both of us everywhere.

## H. What I do after that, each with your yes first

- [ ] **H1. CLAUDE.** Apply all migrations to the practice project, with a dry run first. You say yes before I apply.
- [ ] **H2. CLAUDE.** Add the automatic checks (tests on every change) to GitHub, test first. Then you protect `main` (repository > **Settings** > **Branches** > **Add rule** for `main` > require a pull request and passing checks).
- [ ] **H3. CLAUDE.** Ask you to switch builds back on (E4 > **Automatic**). Then I check a preview of the branch against the practice project, and test sign-up, invite, password reset and booking-confirmation emails.
- [ ] **H4. YOU.** Approve the merge. I open a pull request to `main`; the checks must pass; you merge it. Vercel then publishes the site on `app.yourdomain.com`. As soon as the sign-in page loads there, do step **E11** (switch the live Supabase project's web address to your domain; the practice project stays on `localhost:8080`).
- [ ] **H5. CLAUDE.** (Done on the `vercel.app` address on 5 Oct; repeat on your domain once it is set up.) Repeat the hand test on `https://app.yourdomain.com`, then go through the "before the first real hotel" list in the deployment plan with you.

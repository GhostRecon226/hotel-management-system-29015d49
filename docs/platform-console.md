# Platform console

Wave 2, item 2 (6 Oct 2026). Gate 14: activate, extend, suspend or change a hotel's plan from a screen, never by hand on live. Requirements PLT-008, PLT-009, PLT-013.

## What it is

- Address: `/platform` on the app (practice preview, then live).
- Who: platform operators only. An operator is a **separate sign-in that belongs to no hotel**. Hotel accounts, including hotel System Administrators, are always refused.
- Two-step sign-in with an authenticator app is required. The database checks it on every platform action, not only the screen: a password-only session is refused (`[E_MFA_REQUIRED]`).
- What you see: each hotel's name, country, status, plan, trial end, paid-until date, and the number of properties, rooms and active staff. Never guests, bookings, money or contact details.
- What you can do, each with a reason and a "check before saving" step: activate or extend the paid period (also reactivates), extend a trial (at most a year at a time), change plan (the plan limits apply), suspend, cancel. Nothing is ever deleted.
- Every change is written to the hotel's subscription history with your sign-in email. The hotel sees the new status on its banner; no email is sent yet (decision 4).

## Peter's steps, in order (practice first)

Never paste a password in chat. Use a password manager.

### 1. Check that authenticator apps are allowed (once per project)
Supabase, the project, Authentication, then **Multi-Factor** (or "Sign In / Providers", section Multi-Factor). "Authenticator app (TOTP)" must be **enabled**. It is on by default for hosted projects.

### 2. Create the operator account (once per project)
1. Supabase, the project, Authentication, **Users**, **Add user**, **Create new user**.
2. Email: a second address of yours that no hotel uses. A plus-address works and arrives in your normal inbox, for example `yourname+platform@gmail.com`.
3. Password: a new one from your password manager.
4. Tick **Auto Confirm User** (email does not work on live yet, so no confirmation email is needed).
5. Click **Create user**.

### 3. Make that account an operator: the one SQL line
1. Supabase, the same project, **SQL Editor**, **New query**.
2. Check the project name at the top: on practice it is "Pratice Project", on live it is the live project. Run it on practice first.
3. Paste this line, with the email from step 2, and click **Run**:

```sql
select app.add_platform_operator('yourname+platform@gmail.com');
```

4. The result is one id. That means it worked. Running it twice does no harm.
5. If it says "No sign-in account has that email", check the spelling or do step 2 first. If it says "That account belongs to a hotel", you used a hotel account: create a separate one.

The line is the same for practice and live; only the project you run it in differs.

### 4. Sign in and set up the authenticator app
1. Open the app (practice: the preview address Claude gives you; live: `https://hotel-management-system-29015d49.vercel.app`) and sign in with the operator email and password.
2. The app opens the platform console and asks you to set up an authenticator app: click **Set up the authenticator app**, scan the code (Google Authenticator, Microsoft Authenticator, 1Password and similar all work), type the 6-digit code, **Confirm**.
3. Next time you sign in, you only type the 6-digit code.

### 5. Practice: activate a test hotel (gate 14's proof)
On practice: find a test hotel on its trial, **Manage**, **Activate or extend paid period**, choose a paid-until date and plan, write a reason, **Continue**, check the summary, **Yes, save this change**. The history below shows your change with your email.

## If something goes wrong

- **Lost phone or new phone:** in the SQL Editor of that project, run `delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'yourname+platform@gmail.com');` then sign in again and set up the app again.
- **Remove an operator:** `delete from app.platform_operators where user_id = (select id from auth.users where email = 'their-email');`
- An operator account can never be added to a hotel; a hotel account can never be made an operator. Keep them separate.

## The two demo hotels

Euro Hotel (the demo) and Euro Bar Hotel are on free trials ending around 30 October and 4 November. The daily clock makes a hotel read-only the night its trial ends. In the console they appear under "Trial ends within 7 days" from about a week before. To keep the demo open, use **Extend trial** with a reason such as "Demo hotel for sales visits" (up to a year at a time), or **Activate** when a hotel pays.

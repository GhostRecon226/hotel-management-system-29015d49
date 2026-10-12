# Offline mode: design

Started 11 Oct 2026. Decision A12 said online only in R1 and offline in R2. Peter confirmed on 11 Oct that his hotels lose connection often, so offline moves into the pilot build. This page is the plan. Each stage is its own pull request.

## What the hotel gets

- **Stage 1: read.** After a staff member has signed in once on a device, the app opens without internet. Arrivals, in house, the room board, folio balances and housekeeping tasks show the last saved copy, with a banner: "No connection. Showing the list as of 14:32."
- **Stage 2: write.** Charges, payments, housekeeping updates and service requests can be entered offline. They show as "Waiting to send" and go to the server by themselves when the connection returns. Nothing is lost if the browser closes.
- **Stage 3: check-in and check-out.** Check-in, walk-in, check-out and room moves offline. This is the hard part (see Risks). Peter chose on 12 Oct 2026 to build it now, in two parts. **3a (built): check-out and room moves.** They use the same queue. Both are already safe to repeat in the database (a second check-out returns the first; a second move to the same room is refused). A check-out with a balance is accepted at send time only for someone who holds fo.checkout.unsettled (Peter chose "allow it, flag it for Finance"); the reason recorded is "Checked out with no connection", and the balance shows in Collections. Anyone else sees it under Needs attention. **3b: check-in (built), walk-in (not built).** Check-in of an existing booking uses the same queue and is already safe to repeat (a second check-in returns the first stay). Peter chose on 12 Oct 2026 to keep the ID number on the device only until the entry is sent. A check-in the database refuses has its ID number erased at once and can only be redone online. A walk-in needs a new guest to be made offline, which needs ids made on the device and a database change.

## How it works

1. **Service worker** (`public/sw.js`). Saves the app's files and the page shell on the device the first time they load, so the app starts without internet. The signed-in part of the app is already drawn in the browser (`ssr: false` on `_authenticated`), so one saved shell serves every screen.
2. **Saved lists.** The app already keeps data in TanStack Query. We save the read-only lists to the device (IndexedDB), keyed by the signed-in user, and show them when the network call fails or is paused. Only an allow-list of lists is saved.
3. **Sign-in check.** Today `_authenticated` calls `supabase.auth.getUser()`, which needs internet; offline it would send a signed-in user to the sign-in page. Offline it will read the saved session instead. The server still checks the session on every call, so this adds no access.
4. **Waiting queue** (stage 2). A small queue in IndexedDB. Each entry holds the function name, its arguments and its idempotency key. The key is made when the staff member presses Save, not when it is sent. A retry returns the first result, so a charge never posts twice (rule 7 in AGENTS.md).
5. **Sending.** When the browser is online again, the queue sends entries one at a time, oldest first. A business refusal (for example "folio is closed") moves the entry to a "Needs attention" list with the plain message. It is never dropped silently.
6. **Banner and counts.** A bar at the top shows Online, Offline, or "3 waiting to send". Staff can see the waiting list.

## What stays on the device, and what does not

- Only what the signed-in role may already see. Nothing more.
- Never saved: ID document numbers, ID photos, anything under `guest_documents`, payment card data.
- Signing out clears the saved lists and the queue (the queue asks first if entries are still waiting).
- A shared front desk computer keeps one saved copy per user. Signing in as someone else does not show the first user's data.

## Rules the database keeps

- The server decides everything. The device only shows and queues.
- Money arithmetic stays in Postgres (rule 12). Offline screens show the last figures the server gave, marked with their time. A queued charge shows its entered amount and "Waiting to send", with no totals computed in the browser.
- A queued charge posts on the business date when it arrives, not when it was entered. The entry keeps its entered time in the description or reference for audit.
- Read-only hotels (expired trial) still refuse writes when the queue sends.

## Risks, in business terms

- **Stale lists.** A list can be hours old. Every screen shows its age. Staff must not read a saved room board as live.
- **Two people, same room.** Offline check-in on two devices can pick the same free room. The server refuses the second one when it syncs. That guest then needs a new room. This is why check-in waits for stage 3, with a clear "room taken" screen.
- **Session expiry.** A device offline for days cannot refresh its sign-in. Staff sign in again when the connection returns. Queued entries wait until then.
- **Approvals offline.** Approvals need a second person and a live server. They stay online-only.
- **Browser limits.** A phone browser may clear saved data when storage runs low. The banner warns if the queue is not saved.

## Build order

1. Stage 1: service worker, saved lists, banner, sign-in check, clear on sign out. Browser test with the network switched off.
2. Stage 2: queue and sender for post charge, record payment, housekeeping start/complete, service request. Test: go offline, post, come back, one charge only.
3. Public page: one honest line under the features, written only after stage 1 works. Legal wording is checked with counsel.
4. Stage 3, after real use.

## Tests

- Playwright switches the network off (`context.setOffline(true)`) after loading, reloads, and checks the lists show with the banner.
- A repeat-send test replays the same queue entry twice and checks one posting.
- All run in CI only (this workspace has no Docker).

## Decision for stage 3b (made 12 Oct 2026)

A queued check-in holds the registration, including the ID number, on the device until it sends. Peter chose to keep it there only until it is sent. Sent: the entry is removed, so the number is gone. Refused: the number and expiry are erased from the entry at once. Staff check the guest in again online. Signing out is still refused while entries wait.

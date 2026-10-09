# Pilot hotel dry run: one full day

Purpose: prove one hotel day works from booking to night audit, with real people on real screens, before the first pilot hotel goes live.

## Ground rules

- Run it on **practice**, never live. Use a test hotel with fake guests. Do not type real ID numbers.
- Use at least three sign-ins: **front desk**, **housekeeping** (supervisor and attendant) and **manager**. Two people must be able to approve each other's requests, because one person can never approve their own.
- Keep this page open and mark each step Pass, Fail or Unsure. Write what you saw for any Fail or Unsure. Do not fix anything mid-run; finish the day, then send the list.
- Allow about 2 hours with two people.

## 0. Before you start (5 minutes)

| # | Check | Pass |
|---|---|---|
| 0.1 | Dashboard opens as the manager. If setup is not finished, the "Finish setting up your hotel" card shows. | |
| 0.2 | Setup has room types, rooms, a rate plan with prices, and charge codes. Write down the room types and their nightly rates. | |
| 0.3 | Note today's **business date** (shown in the top bar). All dates below are relative to it. | |
| 0.4 | Cashier: each cashier opens a shift with an opening float (Cashier shift, "Open shift"). | |

## 1. Bookings (front desk)

| # | Step | Expect | Pass |
|---|---|---|---|
| 1.1 | Reservations, New. Book Guest A for 2 nights, arriving today, standard room. | Booking saved with a total equal to 2 nights at the rate you wrote down. | |
| 1.2 | Book Guest B for 3 nights, arriving tomorrow. | Saved. Availability grid shows the room type used on those nights. | |
| 1.3 | Book Guest C arriving today with a **deposit rate plan**. | Saved. Deposit amount follows the plan. | |
| 1.4 | Open the availability grid. Fill the last room of a type, then try one more booking. | The extra booking is refused with a clear "no rooms free" message. | |
| 1.5 | Click Save twice quickly on a booking, or refresh after saving. | One reservation only. | |
| 1.6 | Cancel one test booking. Then reinstate it. | Both work and show in the history. | |

## 2. Arrivals and check-in

| # | Step | Expect | Pass |
|---|---|---|---|
| 2.1 | Front Desk, Arrivals. Check in Guest A. Assign a room. | Guest moves to In house. Room shows occupied on the Rooms board. | |
| 2.2 | Take the deposit for Guest C as a payment, then check in. | Payment shows on the folio. The folio balance drops by the amount. | |
| 2.3 | Enter the **same payment again** within a few minutes. | A "possible duplicate" warning stops it unless you give a reason. | |
| 2.4 | Walk-in: check in a guest with no booking. | Works, with a room and a folio. | |
| 2.5 | Move Guest A to another room. Try moving to the room they are already in. | Move works. The same-room move is refused. | |

## 3. During the stay

| # | Step | Expect | Pass |
|---|---|---|---|
| 3.1 | Open Guest A's folio. Post a charge (for example laundry or minibar). | Charge shows. Balance rises. | |
| 3.2 | Post the room charge for the night from Front Desk. Run it twice. | Charged once. The second run adds nothing. | |
| 3.3 | Ask for a discount larger than the front desk limit. | It becomes an approval request. Nothing posts yet. | |
| 3.4 | As the manager, approve it. Then try approving your own request. | Approval posts the discount. Self-approval is refused. | |
| 3.5 | Create a service request from the In house list. Assign it and complete it. | Chargeable requests post once to the folio. | |
| 3.6 | Extend Guest A's stay by one night. Try the same departure again. | Extension works. The repeat is refused. | |
| 3.7 | Maintenance: raise a ticket for a room, assign, start, resolve, then close it with a **different** person than the one who resolved it. | Same-person close is refused. Block the room and check it leaves availability. | |

## 4. Housekeeping

| # | Step | Expect | Pass |
|---|---|---|---|
| 4.1 | Check out Guest A (see section 5 first if the folio is not zero). | The room turns dirty. A cleaning task opens on the housekeeping board. | |
| 4.2 | Supervisor assigns the task. Attendant (My tasks) starts it and completes it. | Attendant sees only their own tasks. Room waits for inspection. | |
| 4.3 | The attendant tries to inspect their own task. | Refused. A different person must inspect. | |
| 4.4 | Supervisor inspects: fail once with a defect, then pass after redo. | Fail reopens the task. Pass makes the room clean. | |
| 4.5 | Log one lost and found item. | Appears in the list. | |

## 5. Money and check-out

| # | Step | Expect | Pass |
|---|---|---|---|
| 5.1 | Open Guest A's folio. Check the balance by hand against charges and payments. | Matches to the naira. | |
| 5.2 | Try to check out with money still owed. | Refused, with the option to ask for an approved unsettled checkout. | |
| 5.3 | Take payment by cash, then by card or transfer. Check out. | Checks out at zero. Invoice can be issued and printed, with the tax split. | |
| 5.4 | Reverse one payment on a folio that is still open. | Needs approval. The original row stays. A linked reversal row appears. Nothing is deleted. | |
| 5.5 | Undo a check-out on the same day. | Works only on the same business date. | |
| 5.6 | Same-day stay: check in and out on one day. | Charged **one night**. A manager can waive it (decision DAY-006). | |

## 6. End of day

| # | Step | Expect | Pass |
|---|---|---|---|
| 6.1 | Each cashier closes their shift and counts each payment method. | The amounts they should hold match the payments taken. Any difference is shown. | |
| 6.2 | Manager: Admin, Business date. Look at the rollover time and status. | Shows the next roll time and no errors. | |
| 6.3 | Run the night audit ("Run now"). | Business date moves up by one day. Room charges post once. Yesterday's no-shows are marked. Holds that expired are released. | |
| 6.4 | Run it again right away. | Nothing doubles. | |
| 6.5 | Dashboard and Reports. | Occupancy, revenue and balances match your hand count for the day. Export one CSV. | |

## 7. Break it on purpose

| # | Step | Expect | Pass |
|---|---|---|---|
| 7.1 | Sign in as a front desk user and open Admin. | Hidden or refused. | |
| 7.2 | Open a guest's profile as a user without ID permission. | ID numbers are masked. | |
| 7.3 | Open the app on a phone. Do check-in and the attendant task list. | Usable with thumbs, nothing cut off. | |
| 7.4 | Switch off Wi-Fi mid-save, then switch it on and retry. | No double posting; a clear message. | |

## After the run

Send the marked list. For each Fail, say the step number, what you saw and a screenshot if you can.

Decide, with Peter, before the first pilot hotel:

- Every Fail on money, rooms or approvals is fixed and re-run. Layout and wording fails can wait.
- The pilot hotel's own day is run once more with the hotel's real room names, rates and staff on practice before anything goes near live.
- Live stays untouched until Peter says "yes, live" for the release.

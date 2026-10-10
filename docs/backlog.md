# Backlog

Things we know about and chose to do later. Newest at the top. Move an item to a requirement when it is built.

| Item | Why it matters | Added |
| --- | --- | --- |
| **LAST ITEM, NOT DONE: legal pages and production website.** Public site merged on 10 Oct 2026 with stand-in text. The Privacy and Terms pages still hold 13 placeholders, the Terms still say a 30-day trial, and production builds are blocked (`scripts/check-to-confirm.mjs`) until they are filled. Do this after all functions, workflows and the build are complete: counsel reviews the legal pack v0.2 (kept outside the repository), Peter decides the open items, then the placeholders are filled from the final text. The trial and overdue notices, the acceptance record and the offboarding export must be built first. | The website cannot deploy to production until this is done. Merging to main does not change the live hotel database. | 10 Oct 2026 |
| Search box in the top bar (guests, reservations, rooms) | Front desk staff find a guest or booking from any screen. Needs one search function in the database that respects who can see guests. | 9 Oct 2026 |
| Change on in-house guests ("up 12%") on the dashboard | Needs yesterday's in-house figure kept by the nightly roll. Shown only when the figure exists. | 9 Oct 2026 |
| Property photo in the sidebar | Hotels upload a picture for each property. Needs a private image upload like ID photos, plus a Setup screen. | 9 Oct 2026 |
| Weather on the dashboard banner | Optional. Needs each property's location and an outside weather service, so it waits. | 9 Oct 2026 |
| One rule for "money collected" across all reports | The owner summary leaves out a payment reversed the same day. The older payments report still counts it, so two screens can show different totals. | 9 Oct 2026 |
| Daily owner summary by email | Needs the email account and sending domain first. | 9 Oct 2026 |
| Photos on maintenance requests and damage reports | Attendants need to show the problem. Reuse the private storage pattern from ID photos. Maintenance tickets done (MNT-004). Damage reports on lost and found items and service requests are not covered yet. | 9 Oct 2026 |

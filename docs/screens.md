# Screens

Routes are TanStack file routes under `src/routes`. Layout-only routes (`route.tsx` that only render `<Outlet/>` + menu guard) are omitted unless they do work. Functions/views were extracted from the route and the `src/lib/*` hooks it uses; Setup pages also read their tables directly via RLS SELECT.
Every screen inside the shell also relies on `my_context` (loaded once by the shell). Menu items/buttons are hidden with `useAccess().can(key)`.

| Route | Screen | Functions (rpc) | Tables / views read |
|---|---|---|---|
| `/admin` | Admin tabs: Staff (invite via server function), Roles, Approval limits, Audit log, Subscription, Business date (manual rollover), Messages (outbox, Run now). | admin_roles, admin_users, assign_role, audit_filters, audit_log, copy_role, delete_role, outbox_status, register_invited_user, remove_role, rename_role, rollover_status, run_due_rollovers_now, set_approval_limit, set_role_permissions, set_rollover_time, set_user_status, subscription_info | business_date_log, notification_outbox, permissions |
| `/approvals` | Approvals: Waiting for me / My requests / Decided. | decide_approval, withdraw_approval | v_approvals |
| `/checkout/$id` | Check-out: every folio and balance, unsettled approval, undo. | request_unsettled_checkout, undo_checkout | folios, v_approvals, v_checkouts, v_folio_balances |
| `/dashboard` | Today's movements, room status counts, 30-day KPIs chart, pending approvals, open tickets. | dashboard_summary | v_kpi_daily |
| `/folios/$id` | Folio: transactions, balance, post charge, record payment, split, transfer, close/reopen, discount, adjustment, reversal, refund, invoice. | apply_discount, calculate_tax, close_folio, issue_invoice, post_charge, post_payment, reopen_folio, request_adjustment, request_refund, request_reversal, split_folio, transfer_transaction | charge_codes, exchange_rates, invoices, payment_methods, v_approvals, v_folio_balances, v_folio_transactions |
| `/folios/` | Folio list for the property. | — | v_folio_balances |
| `/front-desk` | Tabs Arrivals / In house / Departures today; check-in, walk-in, move, extend, void, service request, post room charges. | create_service_request, extend_stay, get_front_desk_rooms, move_room, open_main_folio, post_room_charges, save_guest, search_guests, svc_staff, void_check_in, walk_in_check_in | charge_codes, rate_plans, room_types, v_arrivals, v_in_house |
| `/downtime` | Printable downtime pack: arrivals due, in house with balance, departures due, blank lines for paper walk-ins, paper routine. Print button. | (none) | v_arrivals, v_in_house, v_folio_balances |
| `/guests/$id` | Guest profile: details, documents (masked), stay history, feedback, edit, anonymise. | add_guest_feedback, anonymise_guest, get_guest, remove_guest_document, save_guest, save_guest_document, set_guest_feedback_status | — |
| `/guests/` | Guest list with search; create. | save_guest, search_guests | — |
| `/guests/merge` | Merge duplicates with preview. | get_guest, merge_guests, search_guests | — |
| `/housekeeping/` | Supervisor board (Open, Assigned, In progress, Waiting inspection, Done). | assign_hk_task, cancel_hk_task, create_hk_task, hk_staff | rooms, v_hk_board |
| `/housekeeping/inspections` | Inspection list with pass / fail and defects. | inspect_hk_task | v_hk_board |
| `/housekeeping/lost-found` | Lost and found list and form. | save_lost_found_item, set_lost_found_status | lost_found_items, rooms |
| `/housekeeping/my-tasks` | Attendant view (mobile first): start, checklist, complete. | complete_hk_task, start_hk_task | v_hk_board |
| `/maintenance/$id` | Ticket detail with all lifecycle actions and Block room. | assign_ticket, block_room_for_ticket, cancel_ticket, close_ticket, mnt_staff, reopen_ticket, resolve_ticket, start_ticket, svc_staff, wait_ticket | room_blocks, v_maintenance_tickets |
| `/maintenance/` | Ticket list and create. | create_ticket, mnt_staff | rooms, v_maintenance_tickets |
| `/reports` | KPI table + CSV, revenue by charge code, outstanding balances, payments, cancellation rate, length of stay, balances by guest, CSV exports, definitions. | export_data, report_balances_by_guest, report_cancellation_rate, report_length_of_stay, report_outstanding_balances, report_payments, report_revenue_by_charge_code | v_kpi_daily |
| `/reservations/$id` | Reservation detail: edit, confirm, cancel, no-show, reinstate, assign room, guests, folios, history. | assign_room, cancel_reservation, confirm_reservation, create_reservation, get_assignable_rooms, get_availability, get_reservation, mark_no_show, modify_reservation, open_main_folio, reinstate_reservation, save_group_booking, search_guests, set_reservation_guests, unassign_room | group_bookings, rate_plans, room_types |
| `/reservations/availability` | 14-night availability grid by room type. | get_availability | — |
| `/reservations/` | Reservation list with search and filters. | search_reservations | — |
| `/reservations/new` | New booking form (also group bookings). | create_reservation, get_availability, modify_reservation, save_group_booking | group_bookings, rate_plans, room_types |
| `/rooms/$id` | Room detail: guest, next arrival, tasks, blocks; set condition, block, release, approve. | approve_room_block, reject_room_block, release_room_block, request_room_block, set_room_condition | room_blocks, v_room_board |
| `/rooms/` | Room board by floor with condition/occupied/sellable filters. | — | v_room_board |
| `/` | App shell: menu, property switcher, business date, notification bell, user menu, subscription banner. Loads my_context into AccessProvider; sends users without a hotel to /create-hotel. | mark_all_notifications_read, mark_notification_read, my_context | notifications |
| `/service-requests` | Service request list and actions (created from Front Desk in-house list). | assign_service_request, cancel_service_request, complete_service_request, mnt_staff, start_service_request, svc_staff | v_service_requests |
| `/setup/charges` | Taxes, charge codes, payment methods (accountant note). | save_charge_code, save_payment_method, save_tax_rate | charge_codes, payment_methods, tax_rates |
| `/setup/exchange-rates` | Exchange rates. | set_exchange_rate | exchange_rates |
| `/setup/` | Setup landing. | — | — |
| `/setup/property` | Property details. | update_property | properties |
| `/setup/rates` | Rate plans and prices. | delete_rate_plan_price, save_rate_plan, save_rate_plan_price | rate_plan_prices, rate_plans, room_types |
| `/setup/room-types` | Room types. | save_room_type | room_types |
| `/setup/rooms` | Rooms with bulk add (e.g. 101–120). | bulk_add_rooms, save_room | room_types, rooms |
| `/create-hotel` | First sign-in: Create your hotel. | create_hotel | — |
| `/invoices/$id` | Printable invoice with tax split and Print button (no app shell). | — | invoices |
| `/` | Auth gate: redirects signed-out users to /auth. | — | — |
| `/auth` | Sign in / sign up (email + password, email confirmation required). | — | — |
| `/check-email` | Check-your-email page after sign-up. | — | — |
| `/design` | Design system preview (every component and status colour). Public. | — | — |
| `/` | Landing: redirects to sign-in or dashboard. | — | — |

Server functions (not database functions):
- `src/lib/invite.functions.ts` — invite staff (Admin → Staff).
- `src/lib/outbox.functions.ts` — Run now / status for the message outbox (Admin → Messages).
- `src/lib/exports.functions.ts` — CSV exports (Reports).

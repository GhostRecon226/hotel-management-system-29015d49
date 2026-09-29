# Known issues

## Message outbox
- Email is not connected yet. Booking confirmations and approval alerts are queued in `notification_outbox` and stay `pending` until Resend is connected (`RESEND_API_KEY`). Optional `OUTBOX_FROM_EMAIL` sets the sender; it must be on a domain verified in Resend.
- No automatic schedule yet. Sending runs only from Admin → Messages → Run now. Once email is connected, add a scheduled job (every minute) that calls a public route running `processOutbox()` from `src/lib/outbox.server.ts`.
- SMS and WhatsApp are stubs: those messages are marked failed with "not set up yet".

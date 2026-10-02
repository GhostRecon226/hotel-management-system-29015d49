import { createFileRoute } from "@tanstack/react-router";
import { outboxCronResponse } from "@/lib/outbox-cron";

// Scheduled sender for the message outbox (booking confirmations, approval alerts), all hotels at once.
// Called by Vercel Cron every 5 minutes (see vite.config.ts). Admin > Messages > Run now does the same for one hotel.
export const Route = createFileRoute("/api/cron/outbox")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        outboxCronResponse(request, { CRON_SECRET: process.env["CRON_SECRET"] }, async () => {
          const { processOutbox } = await import("@/lib/outbox.server");
          return processOutbox({ limit: 50 });
        }),
    },
  },
});

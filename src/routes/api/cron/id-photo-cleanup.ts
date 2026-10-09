import { createFileRoute } from "@tanstack/react-router";
import { cronResponse } from "@/lib/outbox-cron";

// Daily clean-up of ID photo files (GST-009, GST-010): removes from storage every file the database has marked,
// including photos past the keep period. Called by Vercel Cron once a day (see vite.config.ts), with CRON_SECRET.
export const Route = createFileRoute("/api/cron/id-photo-cleanup")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        cronResponse(request, { CRON_SECRET: process.env["CRON_SECRET"] }, async () => {
          const { removeMarkedIdPhotos } = await import("@/lib/id-photos.server");
          let removed = 0;
          for (let i = 0; i < 20; i++) { // at most 4,000 files a day
            const r = await removeMarkedIdPhotos({ limit: 200 });
            removed += r.removed;
            if (r.removed < 200) break;
          }
          // Ticket photos (MNT-004) are cleaned in the same daily run. A problem there never stops the ID photo clean-up.
          let ticketRemoved = 0;
          let ticketProblem: string | null = null;
          try {
            const { removeMarkedTicketPhotos } = await import("@/lib/ticket-photos.server");
            for (let i = 0; i < 20; i++) {
              const r = await removeMarkedTicketPhotos({ limit: 200 });
              ticketRemoved += r.removed;
              if (r.removed < 200) break;
            }
          } catch (e) {
            ticketProblem = e instanceof Error ? e.message : "unknown error";
          }
          return { removed, ticketRemoved, ticketProblem };
        }, "The ID photo clean-up is switched off: CRON_SECRET is not set."),
    },
  },
});

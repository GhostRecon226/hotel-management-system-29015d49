import { createFileRoute } from "@tanstack/react-router";
import { paystackWebhookResponse } from "@/lib/paystack-webhook";

// Paystack calls this when a subscription payment succeeds or fails (PLT-012). The signature is checked first;
// then the database decides: amount and currency must match, a repeat event changes nothing.
// Set this address in the Paystack dashboard (Settings, API Keys and Webhooks). Needs PAYSTACK_SECRET_KEY.
export const Route = createFileRoute("/api/webhooks/paystack")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        paystackWebhookResponse(request, { PAYSTACK_SECRET_KEY: process.env["PAYSTACK_SECRET_KEY"] }, async (e) => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (fn: string, args: Record<string, unknown>) =>
            Promise<{ data: unknown; error: { message: string } | null }>;
          const { data, error } = await rpc("billing_apply_event", {
            p_provider: e.provider, p_event_id: e.eventId, p_reference: e.reference, p_outcome: e.outcome,
            p_amount_minor: e.amountMinor, p_currency: e.currency,
          });
          if (error) throw new Error(error.message);
          return String(data);
        }),
    },
  },
});

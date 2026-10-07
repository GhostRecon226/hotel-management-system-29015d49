// Gate for the Paystack webhook (POST /api/webhooks/paystack). Kept free of app imports so it can be tested alone.
// Paystack signs the raw body with our secret key (HMAC SHA512, header x-paystack-signature). Anything else is refused.
// The database decides what an event means (billing_apply_event): amount check, activation, no double counting.
import { createHmac, timingSafeEqual } from "node:crypto";
import { reportServerError } from "./error-report";

export type BillingEvent = {
  provider: "paystack"; eventId: string; reference: string; outcome: "success" | "failed"; amountMinor: number; currency: string;
};
export type WebhookEnv = { PAYSTACK_SECRET_KEY?: string | undefined };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

export function validSignature(rawBody: string, header: string | null, secret: string) {
  if (!header) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8"); const b = Buffer.from(header.trim().toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function paystackWebhookResponse(request: Request, env: WebhookEnv, apply: (e: BillingEvent) => Promise<string>) {
  if (!env.PAYSTACK_SECRET_KEY) return json(503, { ok: false, error: "Online payments are switched off: PAYSTACK_SECRET_KEY is not set." });
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-paystack-signature"), env.PAYSTACK_SECRET_KEY)) return json(401, { ok: false, error: "Not allowed." });

  let body: { event?: unknown; data?: { id?: unknown; reference?: unknown; amount?: unknown; currency?: unknown } };
  try { body = JSON.parse(raw); } catch { return json(400, { ok: false, error: "Unreadable event." }); }
  const outcome = body.event === "charge.success" ? "success" : body.event === "charge.failed" ? "failed" : null;
  if (!outcome) return json(200, { ok: true, ignored: true });

  const d = body.data ?? {};
  if ((typeof d.id !== "number" && typeof d.id !== "string") || typeof d.reference !== "string" || !d.reference
      || typeof d.amount !== "number" || !Number.isInteger(d.amount) || typeof d.currency !== "string") {
    return json(400, { ok: false, error: "Incomplete event." });
  }
  try {
    const result = await apply({
      provider: "paystack", eventId: `${String(body.event)}:${String(d.id)}`, reference: d.reference, outcome,
      amountMinor: d.amount, currency: d.currency,
    });
    return json(200, { ok: true, result });
  } catch (e) {
    await reportServerError(e, "webhook", new URL(request.url).pathname);
    return json(500, { ok: false, error: "Could not record the event. Please send it again." });
  }
}

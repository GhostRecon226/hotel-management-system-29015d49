import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface CheckoutInput { plan: string; interval: "month" | "year"; key: string; returnUrl: string }

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
type Payment = { reference: string; amount_minor: number; currency: string; status: string };

// PAYSTACK_API_URL exists only so tests can point at a stand-in. Leave it unset in production.
const paystackUrl = () => process.env["PAYSTACK_API_URL"] || "https://api.paystack.co";

/**
 * Starts an online payment for a plan and returns the Paystack page to send the hotel to.
 * Order matters: the database makes the payment first (permission, price, plan fit), and only then do we ask
 * Paystack to open a checkout for exactly that amount. The browser never sends an amount.
 */
export const startPlanCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: CheckoutInput) => {
    if (input?.interval !== "month" && input?.interval !== "year") throw new Error("Choose monthly or yearly.");
    const plan = String(input.plan ?? "").trim();
    const key = String(input.key ?? "").trim();
    if (!plan) throw new Error("Choose a plan.");
    if (!key) throw new Error("Something went wrong. Please try again.");
    return { plan, interval: input.interval, key, returnUrl: String(input.returnUrl ?? "") };
  })
  .handler(async ({ data, context }): Promise<{ url: string; reference: string }> => {
    const secret = process.env["PAYSTACK_SECRET_KEY"];
    if (!secret) throw new Error("Online payment is not switched on yet. Please contact support.");
    const email = typeof context.claims["email"] === "string" ? (context.claims["email"] as string) : "";
    if (!email) throw new Error("Your sign-in has no email address. Please sign in again.");

    // The return address must be a page of this same site.
    let callback: string;
    try {
      const here = new URL(getRequest().url);
      const back = new URL(data.returnUrl);
      if (back.origin !== here.origin || !back.pathname.startsWith("/admin")) throw new Error("bad");
      callback = back.toString();
    } catch { throw new Error("Something went wrong. Please try again."); }

    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as Rpc;
    const started = await rpc("start_subscription_payment", { p_plan: data.plan, p_interval: data.interval, p_idempotency_key: data.key });
    if (started.error) throw new Error(started.error.message);
    const p = started.data as Payment;
    if (p.status === "paid") throw new Error("This payment has already been made.");

    const res = await fetch(`${paystackUrl()}/transaction/initialize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ email, amount: p.amount_minor, currency: p.currency, reference: p.reference, callback_url: callback }),
    });
    const body = (await res.json().catch(() => null)) as { status?: boolean; data?: { authorization_url?: string }; message?: string } | null;
    if (!res.ok || !body?.status || !body.data?.authorization_url) {
      throw new Error("The payment page could not be opened. Please try again in a minute.");
    }
    return { url: body.data.authorization_url, reference: p.reference };
  });

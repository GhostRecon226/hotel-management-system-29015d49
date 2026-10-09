// The Paystack webhook gate, tested on its own (no browser, no server, no database).
// [PLT-012] Only a call signed with our secret key may change a subscription.
import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";
import { paystackWebhookResponse, type BillingEvent } from "../src/lib/paystack-webhook";

const SECRET = "sk_test_unit_secret";
const sign = (body: string, secret = SECRET) => createHmac("sha512", secret).update(body).digest("hex");
const evt = (event: string, extra: object = {}) =>
  JSON.stringify({ event, data: { id: 4242, reference: "hd_abc", amount: 6000000, currency: "NGN", ...extra } });
const req = (body: string, signature?: string) =>
  new Request("http://x/api/webhooks/paystack", { method: "POST", body, headers: signature ? { "x-paystack-signature": signature } : {} });

function spy(result = "applied") {
  const calls: BillingEvent[] = [];
  return { calls, apply: async (e: BillingEvent) => { calls.push(e); return result; } };
}

test("switched off: without the secret key the webhook refuses and changes nothing", async () => {
  const s = spy(); const body = evt("charge.success");
  const res = await paystackWebhookResponse(req(body, sign(body)), {}, s.apply);
  expect(res.status).toBe(503);
  expect(s.calls).toHaveLength(0);
});

test("a call with no signature, a wrong signature or a changed body is refused", async () => {
  const s = spy(); const body = evt("charge.success");
  for (const signature of [undefined, "", "abc", sign(body, "other-secret"), sign(evt("charge.success", { amount: 1 }))]) {
    const res = await paystackWebhookResponse(req(body, signature), { PAYSTACK_SECRET_KEY: SECRET }, s.apply);
    expect(res.status, String(signature)).toBe(401);
  }
  expect(s.calls).toHaveLength(0);
});

test("a signed charge.success is passed on with the amount and currency as sent", async () => {
  const s = spy(); const body = evt("charge.success");
  const res = await paystackWebhookResponse(req(body, sign(body)), { PAYSTACK_SECRET_KEY: SECRET }, s.apply);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, result: "applied" });
  expect(s.calls).toEqual([{ provider: "paystack", eventId: "charge.success:4242", reference: "hd_abc", outcome: "success", amountMinor: 6000000, currency: "NGN" }]);
});

test("a signed charge.failed is passed on as a failure", async () => {
  const s = spy(); const body = evt("charge.failed");
  const res = await paystackWebhookResponse(req(body, sign(body)), { PAYSTACK_SECRET_KEY: SECRET }, s.apply);
  expect(res.status).toBe(200);
  expect(s.calls[0]?.outcome).toBe("failed");
});

test("other events are acknowledged and ignored", async () => {
  const s = spy(); const body = evt("transfer.success");
  const res = await paystackWebhookResponse(req(body, sign(body)), { PAYSTACK_SECRET_KEY: SECRET }, s.apply);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, ignored: true });
  expect(s.calls).toHaveLength(0);
});

test("a signed but malformed event is refused", async () => {
  const s = spy();
  for (const body of ["not json", JSON.stringify({ event: "charge.success", data: {} }), evt("charge.success", { amount: "6000000" })]) {
    const res = await paystackWebhookResponse(req(body, sign(body)), { PAYSTACK_SECRET_KEY: SECRET }, s.apply);
    expect(res.status, body).toBe(400);
  }
  expect(s.calls).toHaveLength(0);
});

test("when the database call fails the answer is 500, so Paystack sends the event again", async () => {
  const body = evt("charge.success");
  const res = await paystackWebhookResponse(req(body, sign(body)), { PAYSTACK_SECRET_KEY: SECRET }, async () => { throw new Error("database unreachable"); });
  expect(res.status).toBe(500);
  expect(await res.text()).not.toContain(SECRET);
});

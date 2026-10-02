// The scheduled sender end to end, against local Supabase and a stand-in for Resend on port 54399.
// Nothing here can reach the real Resend: playwright.config.ts points RESEND_API_URL at the stand-in.
import { test, expect } from "@playwright/test";
import http from "node:http";
import { localSupabase } from "./local-supabase";
import { setUpRoomsAndRates, signInAndCreateHotel } from "./helpers";
import { TEST_CRON_SECRET, TEST_FROM_EMAIL, TEST_RESEND_PORT } from "./test-env";

type Sent = { from: string; to: string[]; subject: string; text: string; auth: string };
let received: Sent[] = [];
let server: http.Server;

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const mail = JSON.parse(body || "{}") as Sent;
      received.push({ ...mail, auth: String(req.headers.authorization ?? "") });
      const fail = mail.to?.some((t) => t.startsWith("fail-"));
      res.writeHead(fail ? 500 : 200, { "content-type": "application/json" });
      res.end(fail ? JSON.stringify({ message: "stand-in refused this address" }) : JSON.stringify({ id: `fake-${received.length}` }));
    });
  });
  await new Promise<void>((r) => server.listen(TEST_RESEND_PORT, "127.0.0.1", () => r()));
});
test.afterAll(async () => { await new Promise((r) => server.close(r)); });

async function outboxRows(recipients: string[]) {
  const s = localSupabase();
  const res = await fetch(`${s.url}/rest/v1/notification_outbox?select=recipient,status,attempts,last_error,next_attempt_at&recipient=in.(${recipients.join(",")})`,
    { headers: { apikey: s.serviceRoleKey, Authorization: `Bearer ${s.serviceRoleKey}` } });
  return (await res.json()) as { recipient: string; status: string; attempts: number; last_error: string | null; next_attempt_at: string }[];
}

test("the scheduled sender address refuses callers without the secret", async ({ request }) => {
  expect((await request.get("/api/cron/outbox")).status()).toBe(401);
  expect((await request.get("/api/cron/outbox", { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);
});

test("a booking confirmation goes out through Resend once; a failed send is retried later, not at once", async ({ page, request }) => {
  await signInAndCreateHotel(page, "outbox");
  await setUpRoomsAndRates(page);
  const stamp = Date.now();
  const ok = `guest-${stamp}@hotel.test`, bad = `fail-${stamp}@hotel.test`;
  const errors = await page.evaluate(async ({ ok, bad }) => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const out: string[] = [];
    const { data: ctx } = await supabase.rpc("my_context" as never);
    const p = (ctx as { properties: { id: string; business_date: string }[] }).properties[0]!;
    const plus = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
    const { data: rt } = await supabase.from("room_types").select("id").eq("property_id", p.id).single();
    const { data: rp } = await supabase.from("rate_plans").select("id").eq("property_id", p.id).single();
    for (const [i, email] of [ok, bad].entries()) {
      const g = await supabase.rpc("save_guest" as never, { p_id: null, p_first_name: "Mail", p_last_name: `Guest${i}`, p_phone: null, p_email: email, p_nationality: "NG", p_address: null, p_notes: null } as never);
      if (g.error) out.push(g.error.message);
      const r = await supabase.rpc("create_reservation" as never, { p_property_id: p.id, p_idempotency_key: crypto.randomUUID(), p_guest_id: g.data, p_arrival: plus(p.business_date, 3 + i), p_departure: plus(p.business_date, 4 + i), p_room_type_id: rt!.id, p_rate_plan_id: rp!.id, p_adults: 1, p_children: 0, p_status: "confirmed", p_source: "direct", p_company_name: null, p_special_requests: null, p_notes: null, p_guarantee: "none", p_hold_until: null, p_group_id: null, p_rate_override: null, p_override_reason: null } as never);
      if (r.error) out.push(r.error.message);
    }
    return out;
  }, { ok, bad });
  expect(errors).toEqual([]);
  expect((await outboxRows([ok, bad])).map((r) => r.status).sort()).toEqual(["pending", "pending"]);

  // The scheduler's call (Vercel Cron sends this header when CRON_SECRET is set).
  const run = await request.get("/api/cron/outbox", { headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` } });
  expect(run.status()).toBe(200);
  expect((await run.json()).ok).toBe(true);

  const mine = received.filter((m) => m.to?.includes(ok));
  expect(mine).toHaveLength(1);
  expect(mine[0]!.subject).toMatch(/is confirmed/);
  expect(mine[0]!.text).toContain("Dear Mail");
  expect(mine[0]!.from).toBe(TEST_FROM_EMAIL);
  expect(mine[0]!.auth).toMatch(/^Bearer /);
  const rows = Object.fromEntries((await outboxRows([ok, bad])).map((r) => [r.recipient, r]));
  expect(rows[ok]!.status).toBe("sent");
  expect(rows[bad]!.status).toBe("pending");
  expect(rows[bad]!.attempts).toBe(1);
  expect(rows[bad]!.last_error).toContain("stand-in refused");
  expect(Date.parse(rows[bad]!.next_attempt_at)).toBeGreaterThan(Date.now());

  // The next run sends nothing twice and waits before retrying the failure.
  await request.get("/api/cron/outbox", { headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` } });
  expect(received.filter((m) => m.to?.includes(ok))).toHaveLength(1);
  expect(received.filter((m) => m.to?.includes(bad))).toHaveLength(1);
});

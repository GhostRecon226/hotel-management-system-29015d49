// The scheduled sender's gate, tested on its own (no browser, no server, no email).
import { test, expect } from "@playwright/test";
import { outboxCronResponse, type OutboxResult } from "../src/lib/outbox-cron";

const result: OutboxResult = { emailReady: true, processed: 2, sent: 1, failed: 1 };
const req = (auth?: string) => new Request("http://x/api/cron/outbox", { headers: auth ? { authorization: auth } : {} });

test("switched off: without CRON_SECRET the sender refuses and sends nothing", async () => {
  let ran = false;
  const res = await outboxCronResponse(req("Bearer anything"), {}, async () => { ran = true; return result; });
  expect(res.status).toBe(503);
  expect((await res.json()).error).toMatch(/switched off/i);
  expect(ran).toBe(false);
});

test("a call without the right secret is refused and sends nothing", async () => {
  let ran = false;
  for (const auth of [undefined, "Bearer wrong", "wrong", "Bearer s3cret-but-longer"]) {
    const res = await outboxCronResponse(req(auth), { CRON_SECRET: "s3cret" }, async () => { ran = true; return result; });
    expect(res.status, String(auth)).toBe(401);
  }
  expect(ran).toBe(false);
});

test("with the right secret it runs the outbox and reports the counts", async () => {
  const res = await outboxCronResponse(req("Bearer s3cret"), { CRON_SECRET: "s3cret" }, async () => result);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, ...result });
});

test("a failure is reported without leaking the secret", async () => {
  const res = await outboxCronResponse(req("Bearer s3cret"), { CRON_SECRET: "s3cret" }, async () => { throw new Error("database unreachable"); });
  expect(res.status).toBe(500);
  const text = await res.text();
  expect(text).toContain("database unreachable");
  expect(text).not.toContain("s3cret");
});

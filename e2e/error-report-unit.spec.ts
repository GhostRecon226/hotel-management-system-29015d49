// Error alerts (wave 2, item 1): what is sent to Sentry, tested on its own (no browser, no server, no network).
// Proves the privacy rules: no personal data, no user, no IP, no replay; expected refusals are never sent.
import { test, expect } from "@playwright/test";
import { buildEvent, envelope, isNoise, parseDsn, scrub, sendError } from "../src/lib/error-report";
import { TEST_ERROR_BROWSER, TEST_ERROR_SERVER } from "../src/lib/test-error.functions";

const DSN = "https://abc123def456@o1.ingest.de.sentry.io/4507";
const ctx = { side: "server" as const, where: "serverFn", path: "/folios/0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d?tab=pay#token=x" };

test("personal data is stripped from messages and paths", () => {
  const msg = "Send to ada.obi@example.com, phone +234 803 123 4567, NIN 12345678901, passport A12345678, " +
    "booking 0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d, url https://x.test/reset?code=abc#access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sigsigsigsig " +
    "key sb_secret_N7UND0UgjKTVK-Uodkm0 Bearer abc.def.ghi";
  const out = scrub(msg);
  for (const leaked of ["ada.obi", "example.com", "803", "4567", "12345678901", "A12345678", "0b1c2d3e", "code=abc", "access_token", "eyJ", "sb_secret", "abc.def.ghi"])
    expect(out, `"${leaked}" must not be sent`).not.toContain(leaked);
  expect(out).toContain("[email]");
  expect(out).toContain("<id>");
  const e = buildEvent(new Error(msg), ctx)!;
  expect(e.transaction).toBe("/folios/<id>");
  expect(JSON.stringify(e)).not.toMatch(/ada\.obi|12345678901|0b1c2d3e|tab=pay|token=x/);
});

test("no user, no IP, no request data, no replay: only the listed fields are sent", () => {
  const e = buildEvent(new Error("boom"), ctx)!;
  expect(Object.keys(e).sort()).toEqual(["environment", "event_id", "exception", "level", "platform", "tags", "timestamp", "transaction"]);
  const text = JSON.stringify(e);
  for (const field of ["user", "ip_address", "request", "cookies", "headers", "breadcrumbs", "contexts", "replay", "extra"])
    expect(text, `${field} must not be sent`).not.toContain(`"${field}"`);
  const env = envelope(e, DSN).split("\n").map((l) => JSON.parse(l));
  expect(env).toHaveLength(3);
  expect(env[1]).toEqual({ type: "event" });
  expect(env.map((x) => Object.keys(x)).flat()).not.toContain("user");
});

test("expected refusals and network noise are never sent", () => {
  expect(buildEvent(new Error("[E_DEPOSIT_REQUIRED] A deposit of 25,000.00 is required before check-in."), ctx)).toBeNull();
  expect(buildEvent({ message: "[E_POSSIBLE_DUPLICATE] A payment of NGN 50,000.00 by Cash..." }, ctx)).toBeNull();
  expect(isNoise("TypeError: Failed to fetch")).toBe(true);
  expect(isNoise("ResizeObserver loop completed with undelivered notifications.")).toBe(true);
  expect(buildEvent(new TypeError("Cannot read properties of undefined (reading 'id')"), ctx)).not.toBeNull();
});

test("nothing is sent without a DSN; with one, a single plain request goes to the EU address", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fake = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(null, { status: 200 }); }) as unknown as typeof fetch;
  expect(await sendError(new Error("boom"), ctx, undefined, fake)).toBe(false);
  expect(await sendError(new Error("boom"), ctx, "not a dsn", fake)).toBe(false);
  expect(calls).toHaveLength(0);
  expect(parseDsn(DSN)).toEqual({ key: "abc123def456", host: "o1.ingest.de.sentry.io", project: "4507" });
  expect(await sendError(new Error("boom"), ctx, DSN, fake)).toBe(true);
  expect(calls).toHaveLength(1);
  expect(calls[0]!.url).toBe("https://o1.ingest.de.sentry.io/api/4507/envelope/?sentry_key=abc123def456&sentry_version=7");
  expect(calls[0]!.init.headers).toBeUndefined(); // no cookies, no auth headers, no content-type preflight
  expect(await sendError(new Error("[E_INVALID] Choose a payment method."), ctx, DSN, fake)).toBe(false);
  expect(calls).toHaveLength(1);
});

test("a failing Sentry never breaks the app", async () => {
  const broken = (async () => { throw new Error("down"); }) as unknown as typeof fetch;
  expect(await sendError(new Error("boom"), ctx, DSN, broken)).toBe(false);
});

test("the two test errors from Setup are sent, readable, and not mistaken for noise", () => {
  for (const msg of [TEST_ERROR_SERVER, TEST_ERROR_BROWSER]) {
    const e = buildEvent(new Error(msg), ctx)!;
    expect(e).not.toBeNull();
    expect(e.exception.values[0]!.value).toBe(msg);
  }
});

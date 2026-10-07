// The morning brief's guard rails, tested on their own (no browser, no database, no real AI service). [AI-005]
import { test, expect } from "@playwright/test";
import { draftUsesOnlyFacts, numbersIn, runBrief } from "../src/lib/ai-brief";

const lines = [
  "Business date: 07 Oct 2026 at Sunrise Lagos.",
  "Last night: 72.5% occupancy (13 of 18 rooms), room revenue NGN 1,250,000.00, total revenue NGN 1,400,000.00.",
  "Today: 3 arrivals still to come, 2 departures still to go, 11 guests in house.",
  "Unpaid for more than 30 days after departure: NGN 85,000.00 on 2 bills.",
];
const env = { ANTHROPIC_API_KEY: "test-key", ANTHROPIC_API_URL: "http://provider.test" };
const reply = (text: string, ok = true) => async () => new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: ok ? 200 : 500 });

test("[AI-005] numbers are read with commas and decimals", () => {
  expect(numbersIn("NGN 1,250,000.00 and 72.5% of 18")).toEqual([1250000, 72.5, 18]);
});

test("[AI-005] a draft that copies the figures is accepted", () => {
  expect(draftUsesOnlyFacts("Occupancy was 72.5% (13 of 18 rooms). NGN 85,000.00 is overdue on 2 bills.", lines)).toBe(true);
});

test("[AI-005] a draft with an invented or rounded figure is refused", () => {
  expect(draftUsesOnlyFacts("Revenue was about 1.25m.", lines)).toBe(false);
  expect(draftUsesOnlyFacts("Occupancy was 73%.", lines)).toBe(false);
  expect(draftUsesOnlyFacts("12 guests are in house.", lines)).toBe(false);
});

test("[AI-005] without a key it stops and calls nothing", async () => {
  let called = false;
  await expect(runBrief(lines, {}, (async () => { called = true; return new Response("{}"); }) as typeof fetch)).rejects.toThrow(/not set up/i);
  expect(called).toBe(false);
});

test("[AI-005] a good draft comes back as the AI draft, and only the fact lines are sent", async () => {
  let sent = "";
  const f = (async (_u: string, init: RequestInit) => { sent = String(init.body); return reply("Three guests arrive today. NGN 85,000.00 is overdue.")(); }) as unknown as typeof fetch;
  const r = await runBrief(lines, env, f);
  expect(r.source).toBe("ai");
  const body = JSON.parse(sent);
  expect(body.messages).toHaveLength(1);
  expect(body.messages[0].content).toBe(lines.join("\n"));
  expect(sent).not.toMatch(/api[-_ ]?key|test-key/i);
});

test("[AI-005] a draft with a wrong figure falls back to the database lines", async () => {
  const r = await runBrief(lines, env, reply("Revenue was 9,999,999.00 last night.") as typeof fetch);
  expect(r.source).toBe("facts");
  expect(r.text).toBe(lines.join("\n"));
  expect(r.note).toMatch(/not in your data/i);
});

test("[AI-005] a provider error is reported, not hidden", async () => {
  await expect(runBrief(lines, env, reply("x", false) as typeof fetch)).rejects.toThrow(/could not write/i);
});

test("[AI-005] an empty reply is reported", async () => {
  await expect(runBrief(lines, env, (async () => new Response(JSON.stringify({ content: [] }))) as typeof fetch)).rejects.toThrow(/returned nothing/i);
});

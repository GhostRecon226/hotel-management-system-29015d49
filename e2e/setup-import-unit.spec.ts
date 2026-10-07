// The setup import assistant's guard rails, tested on their own (no browser, no database, no real AI service). [AI-007]
import { test, expect } from "@playwright/test";
import { limitToSource, parseProposal, runDraft, screenInput } from "../src/lib/setup-import";

const list = "Standard rooms 101 to 104 on floor 1, sleeps 2. Deluxe rooms 201, 202 and Garden 1 on floor 2, sleeps 3.";
const env = { ANTHROPIC_API_KEY: "test-key", ANTHROPIC_API_URL: "http://provider.test" };
const reply = (obj: unknown, ok = true) => (async () => new Response(JSON.stringify({ content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj) }] }), { status: ok ? 200 : 500 })) as typeof fetch;
const good = {
  room_types: [{ code: "STD", name: "Standard", max_adults: 2 }, { code: "DLX", name: "Deluxe", max_adults: 3 }],
  rooms: [101, 102, 103, 104].map((n) => ({ number: String(n), type_code: "STD", floor: "1" }))
    .concat([{ number: "201", type_code: "DLX", floor: "2" }, { number: "202", type_code: "DLX", floor: "2" }, { number: "Garden 1", type_code: "DLX", floor: "2" }]),
};

test("[AI-007] pasted text with an email, phone or card number is refused before anything is sent", () => {
  expect(screenInput("")).toMatch(/paste your room list/i);
  expect(screenInput("101 Deluxe, contact ada@example.com")).toMatch(/email/i);
  expect(screenInput("201 Standard, call 08031234567")).toMatch(/phone or card/i);
  expect(screenInput("201 Standard, call +234 803 123 4567")).toMatch(/phone or card/i);
  expect(screenInput("x".repeat(20001))).toMatch(/too long/i);
});

test("[AI-007] an ordinary list with room numbers and prices passes the screen", () => {
  expect(screenInput(list)).toBeNull();
  expect(screenInput("101 102 103 104 105 106 107 108 109 110 at 45,000 each")).toBeNull();
});

test("[AI-007] a reply is read even with text around the JSON, and a broken one is reported", () => {
  expect(parseProposal("Here you go: " + JSON.stringify(good) + " Done.").rooms).toHaveLength(7);
  expect(() => parseProposal("no json here")).toThrow(/could not be read/i);
  expect(() => parseProposal('{"room_types":[]}')).toThrow(/could not be read/i);
});

test("[AI-007] a faithful draft is kept whole, rooms inside a written range included", () => {
  const r = limitToSource(parseProposal(JSON.stringify(good)), list, []);
  expect(r.proposal.rooms).toHaveLength(7);
  expect(r.proposal.room_types).toEqual([{ code: "STD", name: "Standard", max_adults: 2 }, { code: "DLX", name: "Deluxe", max_adults: 3 }]);
  expect(r.notes).toEqual([]);
});

test("[AI-007] invented rooms, floors and guest limits are dropped, not passed on", () => {
  const p = parseProposal(JSON.stringify({
    room_types: [{ code: "STD", name: "Standard", max_adults: 4 }, { code: "SUI", name: "Presidential Suite" }],
    rooms: [{ number: "101", type_code: "STD", floor: "9" }, { number: "999", type_code: "STD" }, { number: "301", type_code: "SUI" }, { number: "102", type_code: "NOPE" }],
  }));
  const r = limitToSource(p, list, []);
  expect(r.proposal.rooms).toEqual([{ number: "101", type_code: "STD" }]);
  expect(r.proposal.room_types).toEqual([{ code: "STD", name: "Standard" }]);
  expect(r.notes.join(" ")).toMatch(/3 rooms left out/);
  expect(r.notes.join(" ")).toMatch(/floor/);
  expect(r.notes.join(" ")).toMatch(/room type/);
});

test("[AI-007] an existing hotel type code can be used without naming it in the list", () => {
  const r = limitToSource(parseProposal(JSON.stringify({ room_types: [], rooms: [{ number: "101", type_code: "std" }] })), list, ["STD"]);
  expect(r.proposal.rooms).toEqual([{ number: "101", type_code: "STD" }]);
});

test("[AI-007] a draft with no matching rooms is an error", () => {
  expect(() => limitToSource(parseProposal(JSON.stringify({ room_types: [], rooms: [{ number: "777", type_code: "STD" }] })), list, ["STD"])).toThrow(/no rooms that match/i);
});

test("[AI-007] the whole flow: refuses personal details without calling the provider, sends only the list", async () => {
  let calls = 0; let sent = "";
  const f = (async (_u: string, init: RequestInit) => { calls++; sent = String(init.body); return reply(good)(_u, init); }) as unknown as typeof fetch;
  await expect(runDraft("101 Deluxe ada@example.com", [], env, f)).rejects.toThrow(/email/i);
  expect(calls).toBe(0);
  await expect(runDraft(list, [], {}, f)).rejects.toThrow(/not set up/i);
  expect(calls).toBe(0);
  const r = await runDraft(list, ["STD"], env, f);
  expect(r.proposal.rooms).toHaveLength(7);
  expect(sent).toContain(list);
  expect(sent).not.toMatch(/test-key/);
});

test("[AI-007] provider errors and empty replies are reported", async () => {
  await expect(runDraft(list, [], env, reply("x", false))).rejects.toThrow(/could not read the list/i);
  await expect(runDraft(list, [], env, (async () => new Response(JSON.stringify({ content: [] }))) as typeof fetch)).rejects.toThrow(/returned nothing/i);
});

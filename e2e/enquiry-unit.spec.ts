// The website enquiry, tested on its own (no browser, no real email service). [PLT-019]
import { test, expect } from "@playwright/test";
import { cleanEnquiry, sendEnquiry } from "../src/lib/enquiry";

const good = { subject: "Pilot access", replyTo: "ada@hotel.ng", website: "", fields: [{ label: "Full name", value: "Ada" }, { label: "Message", value: "Hello" }] };
const env = { RESEND_API_KEY: "k", RESEND_API_URL: "http://mail.test" };
const reply = (ok: boolean) => async () => new Response("{}", { status: ok ? 200 : 500 });

test("[PLT-019] a good enquiry is cleaned and kept", () => {
  expect(cleanEnquiry(good)?.fields.length).toBe(2);
});

test("[PLT-019] an empty enquiry or a bad reply address is refused", () => {
  expect(cleanEnquiry({ ...good, fields: [{ label: "Message", value: "  " }] })).toBeNull();
  expect(cleanEnquiry({ ...good, replyTo: "not an email" })).toBeNull();
  expect(cleanEnquiry(null)).toBeNull();
});

test("[PLT-019] a line break in the subject cannot add email headers", () => {
  expect(cleanEnquiry({ ...good, subject: "Hi\r\nBcc: x@y.z" })?.subject).toBe("Hi Bcc: x@y.z");
});

test("[PLT-019] it sends one email to the contact address with the visitor as reply-to", async () => {
  let body: Record<string, unknown> = {};
  const r = await sendEnquiry(good, env, async (_u, init) => { body = JSON.parse(String(init.body)); return new Response("{}", { status: 200 }); });
  expect(r).toEqual({ sent: true });
  expect(body["to"]).toEqual(["hello@zikorahq.com"]);
  expect(body["reply_to"]).toBe("ada@hotel.ng");
  expect(String(body["text"])).toContain("Full name: Ada");
});

test("[PLT-019] with no email key it says it did not send", async () => {
  expect(await sendEnquiry(good, {}, reply(true))).toEqual({ sent: false, reason: "not_configured" });
});

test("[PLT-019] a failing email service is reported, not hidden", async () => {
  expect(await sendEnquiry(good, env, reply(false))).toEqual({ sent: false, reason: "failed" });
});

test("[PLT-019] a filled hidden field (a bot) sends nothing", async () => {
  let called = false;
  await sendEnquiry({ ...good, website: "spam.example" }, env, async () => { called = true; return new Response("{}"); });
  expect(called).toBe(false);
});

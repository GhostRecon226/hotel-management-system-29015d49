// Website enquiry: checks the form, builds the email and sends it through Resend. [PLT-019]
// No database, no sign-in. Nothing is stored. If no Resend key is set, nothing is sent and the caller says so.
import { SITE_INFO } from "@/lib/site-info";

export type EnquiryResult = { sent: boolean; reason?: "not_configured" | "invalid" | "failed" };
type Env = Record<string, string | undefined>;
type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const MAX_FIELDS = 12;
const MAX_VALUE = 2000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EnquiryInput = { subject: string; fields: { label: string; value: string }[]; replyTo: string; website: string };

/** Returns the cleaned enquiry, or null when it should not be sent. A filled hidden "website" field means a bot. */
export function cleanEnquiry(raw: unknown): EnquiryInput | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const text = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
  const subject = text(r["subject"], 120).replace(/[\r\n]+/g, " ");
  const replyTo = text(r["replyTo"], 200);
  const website = text(r["website"], 200);
  const list = Array.isArray(r["fields"]) ? (r["fields"] as unknown[]).slice(0, MAX_FIELDS) : [];
  const fields = list.map((f) => ({ label: text((f as Record<string, unknown>)?.["label"], 80), value: text((f as Record<string, unknown>)?.["value"], MAX_VALUE) }));
  if (!subject || fields.length === 0 || fields.every((f) => !f.value)) return null;
  if (replyTo && !EMAIL.test(replyTo)) return null;
  return { subject, fields, replyTo, website };
}

export function enquiryText(e: EnquiryInput): string {
  return e.fields.map((f) => `${f.label}: ${f.value || "-"}`).join("\n\n");
}

export async function sendEnquiry(raw: unknown, env: Env, doFetch: Fetch = fetch as Fetch): Promise<EnquiryResult> {
  const e = cleanEnquiry(raw);
  if (!e) return { sent: false, reason: "invalid" };
  if (e.website) return { sent: true }; // bot: look like success, send nothing
  const key = env["RESEND_API_KEY"];
  if (!key) return { sent: false, reason: "not_configured" };
  const base = env["RESEND_API_URL"] || "https://api.resend.com";
  try {
    const res = await doFetch(`${base}/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: env["OUTBOX_FROM_EMAIL"] || "Zikora <onboarding@resend.dev>",
        to: [SITE_INFO["contact email"]],
        ...(e.replyTo ? { reply_to: e.replyTo } : {}),
        subject: `Website enquiry: ${e.subject}`,
        text: enquiryText(e),
      }),
    });
    return res.ok ? { sent: true } : { sent: false, reason: "failed" };
  } catch {
    return { sent: false, reason: "failed" };
  }
}

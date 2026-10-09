// Server-only: sends queued messages from notification_outbox.
// Email goes straight to Resend (decision 5d) once RESEND_API_KEY is set; SMS and WhatsApp are stubs.

type OutboxRow = { id: string; channel: "email" | "sms" | "whatsapp"; recipient: string; subject: string | null; body: string };

// RESEND_API_URL exists only so the browser tests can point at a local stand-in. Leave it unset in production.
const resendUrl = () => process.env["RESEND_API_URL"] || "https://api.resend.com";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendEmail(row: OutboxRow, resendKey: string) {
  const from = process.env["OUTBOX_FROM_EMAIL"] || "Zikora <onboarding@resend.dev>";
  const res = await fetch(`${resendUrl()}/emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from, to: [row.recipient], subject: row.subject ?? "Message from your hotel", text: row.body,
      html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(row.body)}</div>`,
    }),
  });
  if (!res.ok) throw new Error(`Email service error [${res.status}]: ${(await res.text()).slice(0, 500)}`);
}

export async function processOutbox(opts: { tenantId?: string | null; limit?: number } = {}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const resendKey = process.env["RESEND_API_KEY"];
  const emailReady = !!resendKey;
  // Without an email service, email rows stay pending (not lost) until one is connected.
  const channels = emailReady ? ["email", "sms", "whatsapp"] : ["sms", "whatsapp"];

  const { data, error } = await supabaseAdmin.rpc("outbox_claim", {
    p_limit: opts.limit ?? 25, p_channels: channels, ...(opts.tenantId ? { p_tenant: opts.tenantId } : {}),
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as OutboxRow[];

  let sent = 0, failed = 0;
  for (const row of rows) {
    try {
      if (row.channel === "email") {
        await sendEmail(row, resendKey!);
        await supabaseAdmin.rpc("outbox_mark", { p_id: row.id, p_ok: true });
        sent++;
      } else {
        await supabaseAdmin.rpc("outbox_mark", { p_id: row.id, p_ok: false, p_error: `${row.channel.toUpperCase()} sending is not set up yet.`, p_final: true });
        failed++;
      }
    } catch (e) {
      await supabaseAdmin.rpc("outbox_mark", { p_id: row.id, p_ok: false, p_error: e instanceof Error ? e.message : String(e) });
      failed++;
    }
  }
  return { emailReady, processed: rows.length, sent, failed };
}

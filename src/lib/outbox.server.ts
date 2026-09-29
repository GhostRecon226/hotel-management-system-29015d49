// Server-only: sends queued messages from notification_outbox.
// Email goes through Resend once it is connected; SMS and WhatsApp are stubs.

type OutboxRow = { id: string; channel: "email" | "sms" | "whatsapp"; recipient: string; subject: string | null; body: string };

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendEmail(row: OutboxRow, lovableKey: string, resendKey: string) {
  const from = process.env["OUTBOX_FROM_EMAIL"] || "Hotel Desk <onboarding@resend.dev>";
  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": resendKey },
    body: JSON.stringify({
      from, to: [row.recipient], subject: row.subject ?? "Message from your hotel", text: row.body,
      html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(row.body)}</div>`,
    }),
  });
  if (!res.ok) throw new Error(`Email service error [${res.status}]: ${(await res.text()).slice(0, 500)}`);
}

export async function processOutbox(opts: { tenantId?: string | null; limit?: number } = {}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const resendKey = process.env["RESEND_API_KEY"];
  const emailReady = !!(lovableKey && resendKey);
  // Without an email service, email rows stay pending (not lost) until one is connected.
  const channels = emailReady ? ["email", "sms", "whatsapp"] : ["sms", "whatsapp"];

  const { data, error } = await supabaseAdmin.rpc("outbox_claim", {
    p_limit: opts.limit ?? 25, p_channels: channels, p_tenant: opts.tenantId ?? undefined,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as OutboxRow[];

  let sent = 0, failed = 0;
  for (const row of rows) {
    try {
      if (row.channel === "email") {
        await sendEmail(row, lovableKey!, resendKey!);
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

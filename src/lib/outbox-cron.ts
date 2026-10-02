// Gate for the scheduled sender (GET /api/cron/outbox). Kept free of app imports so it can be tested alone.
// Vercel Cron calls the address every 5 minutes with "Authorization: Bearer <CRON_SECRET>".
// Switched off until CRON_SECRET is set; emails stay queued until RESEND_API_KEY is set.

export type OutboxResult = { emailReady: boolean; processed: number; sent: number; failed: number };
export type CronEnv = { CRON_SECRET?: string | undefined };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

// Same time whatever the input, so the secret cannot be guessed from how fast a wrong one is refused.
function sameText(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function outboxCronResponse(request: Request, env: CronEnv, run: () => Promise<OutboxResult>) {
  if (!env.CRON_SECRET) return json(503, { ok: false, error: "The scheduled sender is switched off: CRON_SECRET is not set." });
  if (!sameText(request.headers.get("authorization") ?? "", `Bearer ${env.CRON_SECRET}`)) return json(401, { ok: false, error: "Not allowed." });
  try {
    return json(200, { ok: true, ...(await run()) });
  } catch (e) {
    return json(500, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

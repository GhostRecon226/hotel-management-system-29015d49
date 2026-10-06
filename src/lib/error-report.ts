// Error alerts (wave 2, item 1, 6 Oct 2026). Sends unexpected errors to Sentry using Sentry's documented event
// format, with no Sentry package: only the fields built here leave the app.
// Privacy, by design:
//   * no session replay, no user identification, no IP address, no cookies, headers, request bodies or form values;
//   * messages and stacks are stripped of emails, phone and ID numbers, record ids, tokens and query strings;
//   * expected refusals ("[E_CODE] message", e.g. "deposit required") are normal answers, not faults: never sent;
//   * nothing is sent unless a DSN is set (Vercel Production only), so previews and local runs send nothing.
// Kept free of app imports so it can be tested alone (e2e/error-report-unit.spec.ts).

export type Side = "browser" | "server";
export interface ReportContext { side: Side; where: string; path?: string | undefined; environment?: string | undefined; release?: string | undefined }

const NOISE = [
  /^\[E_[A-Z0-9_]+\]/, // expected refusals from the database
  /Failed to fetch|NetworkError|Load failed|network connection was lost|The Internet connection appears to be offline/i,
  /ResizeObserver loop/i,
  /AbortError|The (operation|user) (was )?abort/i,
  /^Script error\.?$/i,
  /chrome-extension:|moz-extension:|safari-extension:/i,
];

const SCRUB: Array<[RegExp, string]> = [
  [/\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{5,}/g, "[token]"], // JWTs (Supabase sessions)
  [/\b(?:sb_(?:secret|publishable)_|re_|sk_|pk_)[\w-]{8,}/g, "[key]"],
  [/\bBearer\s+[\w.~+/=-]+/gi, "Bearer [token]"],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[email]"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<id>"],
  [/\?[^\s)"'#]*/g, ""], // query strings
  [/#[^\s)"']*/g, ""], // URL fragments (auth links carry tokens there)
  [/\+?\d[\d\s().-]{7,}\d/g, "[number]"], // phone numbers
  [/\b[A-Z]{0,4}-?\d{5,}\b/gi, "[number]"], // ID, passport, NIN, card and account numbers
];

export function scrub(text: string, max = 2000): string {
  let out = text;
  for (const [re, to] of SCRUB) out = out.replace(re, to);
  return out.length > max ? `${out.slice(0, max)}…` : out;
}

export function isNoise(message: string): boolean {
  return NOISE.some((re) => re.test(message));
}

/** Stack lines like "at fn (https://site/assets/x.js:1:2)" or "fn@https://site/x.js:1:2", oldest frame first. */
function frames(stack: string | undefined) {
  if (!stack) return undefined;
  const out: Array<{ function?: string | undefined; filename: string; lineno: number; colno: number }> = [];
  for (const line of stack.split("\n").slice(0, 40)) {
    const m = line.match(/^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/) ?? line.match(/^(.*?)@(.+?):(\d+):(\d+)$/);
    if (!m) continue;
    out.push({ function: m[1] ? scrub(m[1], 200) : undefined, filename: scrub(m[2]!, 300), lineno: Number(m[3]), colno: Number(m[4]) });
  }
  return out.length ? { frames: out.reverse() } : undefined;
}

function describe(error: unknown): { type: string; value: string; stack?: string | undefined } {
  if (error instanceof Error) return { type: error.name || "Error", value: error.message, stack: error.stack };
  if (typeof error === "string") return { type: "Error", value: error };
  if (error && typeof error === "object" && "message" in error) return { type: "Error", value: String((error as { message: unknown }).message) };
  return { type: "Error", value: "Unknown error" };
}

/** The event that would be sent, or null when there is nothing to send (expected refusal or noise). */
export function buildEvent(error: unknown, ctx: ReportContext, now = new Date()) {
  const d = describe(error);
  if (isNoise(d.value) || isNoise(d.stack ?? "")) return null;
  return {
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: now.toISOString(),
    platform: ctx.side === "browser" ? "javascript" : "node",
    level: "error",
    environment: ctx.environment ?? "production",
    ...(ctx.release ? { release: ctx.release } : {}),
    tags: { side: ctx.side, where: ctx.where },
    ...(ctx.path ? { transaction: scrub(ctx.path, 300) } : {}),
    exception: { values: [{ type: scrub(d.type, 100), value: scrub(d.value), stacktrace: frames(d.stack) }] },
  };
}

export function parseDsn(dsn: string | undefined) {
  const m = dsn?.trim().match(/^https:\/\/([0-9a-f]+)@([\w.-]+)\/(\d+)$/i);
  return m ? { key: m[1]!, host: m[2]!, project: m[3]! } : null;
}

export function envelope(event: NonNullable<ReturnType<typeof buildEvent>>, dsn: string) {
  return [JSON.stringify({ event_id: event.event_id, sent_at: new Date().toISOString(), dsn }), JSON.stringify({ type: "event" }), JSON.stringify(event)].join("\n");
}

/** Sends one error. Never throws and never blocks the caller for long. */
export async function sendError(error: unknown, ctx: ReportContext, dsn: string | undefined, doFetch: typeof fetch = fetch) {
  try {
    const d = parseDsn(dsn);
    if (!d) return false;
    const event = buildEvent(error, ctx);
    if (!event) return false;
    const url = `https://${d.host}/api/${d.project}/envelope/?sentry_key=${d.key}&sentry_version=7`;
    // No content-type header: a plain text body needs no CORS preflight from the browser.
    await doFetch(url, { method: "POST", body: envelope(event, dsn!.trim()), keepalive: true, signal: AbortSignal.timeout(3000) });
    return true;
  } catch {
    return false;
  }
}

// Browser: at most 10 reports per page load, and each message once.
let sentCount = 0;
const seen = new Set<string>();
export function reportBrowserError(error: unknown, where: string) {
  const dsn = import.meta.env["VITE_SENTRY_DSN"] as string | undefined;
  if (!dsn || typeof window === "undefined" || sentCount >= 10) return;
  const key = `${where}:${describe(error).value}`;
  if (seen.has(key)) return;
  seen.add(key); sentCount++;
  void sendError(error, { side: "browser", where, path: window.location.pathname }, dsn);
}

let installed = false;
export function installBrowserErrorReporting() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => reportBrowserError(e.error ?? e.message, "window"));
  window.addEventListener("unhandledrejection", (e) => reportBrowserError(e.reason, "promise"));
}

export function reportServerError(error: unknown, where: string, path?: string) {
  return sendError(error, {
    side: "server", where, path, environment: process.env["VERCEL_ENV"] ?? "production",
    release: process.env["VERCEL_GIT_COMMIT_SHA"]?.slice(0, 12),
  }, process.env["SENTRY_DSN"]);
}

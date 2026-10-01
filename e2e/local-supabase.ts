// Reads the LOCAL Supabase address and keys from the Supabase CLI, and refuses anything that is not local.
import { execSync } from "node:child_process";

export interface LocalSupabase {
  url: string;
  mailUrl: string;
  publishableKey: string;
  serviceRoleKey: string;
}

let cached: LocalSupabase | undefined;

export function localSupabase(): LocalSupabase {
  if (cached) return cached;
  const out = execSync("supabase status -o env", {
    env: { ...process.env, SUPABASE_PROJECT_ID: "hotel-desk" },
    stdio: ["ignore", "pipe", "ignore"],
  }).toString();
  const get = (k: string) => out.match(new RegExp(`^${k}="?([^"\\n]+)"?$`, "m"))?.[1] ?? "";
  const url = get("API_URL");
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) {
    throw new Error(`Browser tests only run against local Supabase. Got "${url}". Run: supabase start`);
  }
  cached = { url, mailUrl: get("MAILPIT_URL") || get("INBUCKET_URL"), publishableKey: get("PUBLISHABLE_KEY") || get("ANON_KEY"), serviceRoleKey: get("SERVICE_ROLE_KEY") };
  return cached;
}

/** Creates a confirmed local test user with a generated password. */
export async function createTestUser(label: string) {
  const s = localSupabase();
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.local`;
  const password = `Test-${crypto.randomUUID()}`;
  const res = await fetch(`${s.url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: s.serviceRoleKey, Authorization: `Bearer ${s.serviceRoleKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`Could not create local test user: ${res.status} ${await res.text()}`);
  return { email, password };
}

/** Signs in through the Auth API and returns the tokens, like the ones an email confirmation link carries. */
export async function passwordTokens(email: string, password: string) {
  const s = localSupabase();
  const res = await fetch(`${s.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: s.publishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Local sign-in failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { access_token: string; refresh_token: string; expires_in: number; expires_at: number };
}

/** Waits for the newest email to an address in the local test mailbox (Mailpit) and returns its first link to Auth. */
export async function latestAuthLink(to: string, subject: RegExp, timeoutMs = 15_000) {
  const s = localSupabase();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const list = await (await fetch(`${s.mailUrl}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)).json() as
      { messages: { ID: string; Subject: string }[] };
    const m = list.messages.find((x) => subject.test(x.Subject));
    if (m) {
      const msg = await (await fetch(`${s.mailUrl}/api/v1/message/${m.ID}`)).json() as { HTML: string; Text: string };
      const link = (msg.HTML.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1] ?? msg.Text.match(/(https?:\/\/\S*\/auth\/v1\/verify\S*)/)?.[1]);
      if (link) return link.replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No "${subject}" email for ${to} in the local mailbox`);
}

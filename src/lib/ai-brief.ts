// Morning brief: asks the AI provider to turn database figures into a short plain draft, and refuses any draft
// that contains a number the database did not give. Pure logic, no framework, so it can be tested on its own.

export type BriefEnv = { ANTHROPIC_API_KEY?: string | undefined; ANTHROPIC_API_URL?: string | undefined; AI_MODEL?: string | undefined };
export type BriefResult = { text: string; source: "ai" | "facts"; note?: string };

const DEFAULT_URL = "https://api.anthropic.com";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

const SYSTEM = [
  "You write a morning brief for a hotel owner from a list of facts.",
  "Use only the facts given. Never add, round, convert or estimate a number. Copy every figure exactly as written, with its commas and decimals.",
  "Do not abbreviate amounts (no k, m or bn). Do not mention anything that is not in the facts.",
  "Plain, short sentences. No em dashes. No greeting and no sign-off. At most 120 words.",
  "Say what needs attention first.",
].join(" ");

/** Every number written in the text, as a plain value (commas removed). "NGN 1,250,000.00" gives 1250000. */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) out.push(Number(m[0].replace(/,/g, "")));
  return out;
}

/** True when every number in the draft also appears in the facts. */
export function draftUsesOnlyFacts(draft: string, lines: string[]): boolean {
  const allowed = new Set(lines.flatMap(numbersIn));
  return numbersIn(draft).every((n) => allowed.has(n));
}

export async function runBrief(
  lines: string[], env: BriefEnv, fetchImpl: typeof fetch = fetch,
): Promise<BriefResult> {
  if (!env.ANTHROPIC_API_KEY) throw new Error("AI is not set up yet. The platform owner needs to add the AI key.");
  const base = (env.ANTHROPIC_API_URL || DEFAULT_URL).replace(/\/$/, "");
  const res = await fetchImpl(`${base}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: env.AI_MODEL || DEFAULT_MODEL, max_tokens: 400, system: SYSTEM,
      messages: [{ role: "user", content: lines.join("\n") }],
    }),
  });
  if (!res.ok) throw new Error("The AI service could not write the brief. Try again in a few minutes.");
  const body = (await res.json().catch(() => null)) as { content?: { type: string; text?: string }[] } | null;
  const draft = (body?.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
  if (!draft) throw new Error("The AI service returned nothing. Try again in a few minutes.");
  if (!draftUsesOnlyFacts(draft, lines)) {
    return { text: lines.join("\n"), source: "facts", note: "The AI draft had a figure that is not in your data, so the plain figures are shown instead." };
  }
  return { text: draft, source: "ai" };
}

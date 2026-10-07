// Setup import assistant: turns a pasted room list into a draft list of room types and rooms.
// The draft is only a proposal. The hotel sees a preview, and the database checks and adds it (apply_setup_import).
// Guard rails here: the pasted text must not hold personal details, and the draft may only contain what was pasted.
import type { BriefEnv } from "@/lib/ai-brief";

export type ImportType = { code: string; name: string; max_adults?: number; max_children?: number };
export type ImportRoom = { number: string; type_code: string; floor?: string };
export type ImportProposal = { room_types: ImportType[]; rooms: ImportRoom[] };
export type DraftResult = { proposal: ImportProposal; notes: string[] };

const MAX_TEXT = 20000;
const MAX_ROOMS = 500;
const MAX_TYPES = 50;

const SYSTEM = [
  "You turn a hotel's pasted room list into JSON. Reply with the JSON only, no other text.",
  'Shape: {"room_types":[{"code":"","name":"","max_adults":0,"max_children":0}],"rooms":[{"number":"","type_code":"","floor":""}]}.',
  "Use only what is written. Copy room numbers, names and floors exactly as written. Never invent a room, a number or a floor.",
  "Leave max_adults, max_children and floor out unless they are written. If a range such as 101 to 110 is written, list every room in it.",
  "Make each type code short, upper case, letters only. Reuse an existing code when a room clearly belongs to that type.",
].join(" ");

/** Returns a message when the pasted text must not be sent, or null when it is fine. */
export function screenInput(text: string): string | null {
  if (!text || !text.trim()) return "Paste your room list first.";
  if (text.length > MAX_TEXT) return "The list is too long. Paste up to 20,000 characters at a time.";
  if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(text) || /\d{10,}/.test(text) || /\+\d[\d\s-]{8,}/.test(text)) {
    return "This looks like it has an email address or a phone or card number. Paste only room names, numbers, floors and types.";
  }
  return null;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function asString(v: unknown): string { return typeof v === "string" || typeof v === "number" ? String(v).trim() : ""; }

/** Reads the model's reply into a proposal. Throws a plain message when it is not usable. */
export function parseProposal(raw: string): ImportProposal {
  const start = raw.indexOf("{"); const end = raw.lastIndexOf("}");
  let data: unknown;
  try { data = JSON.parse(raw.slice(start, end + 1)); } catch { throw new Error("The AI draft could not be read. Try again, or add the rooms by hand."); }
  const d = data as { room_types?: unknown; rooms?: unknown };
  if (!d || !Array.isArray(d.rooms)) throw new Error("The AI draft could not be read. Try again, or add the rooms by hand.");
  const types: ImportType[] = (Array.isArray(d.room_types) ? d.room_types : []).slice(0, MAX_TYPES).map((t: Record<string, unknown>) => {
    const out: ImportType = { code: asString(t?.["code"]).toUpperCase(), name: asString(t?.["name"]) };
    const a = Number(t?.["max_adults"]); const c = Number(t?.["max_children"]);
    if (Number.isInteger(a) && a >= 1 && a <= 99) out.max_adults = a;
    if (t?.["max_children"] != null && Number.isInteger(c) && c >= 0 && c <= 99) out.max_children = c;
    return out;
  });
  const rooms: ImportRoom[] = (d.rooms as Record<string, unknown>[]).slice(0, MAX_ROOMS).map((r) => {
    const out: ImportRoom = { number: asString(r?.["number"]), type_code: asString(r?.["type_code"]).toUpperCase() };
    const f = asString(r?.["floor"]); if (f) out.floor = f;
    return out;
  });
  return { room_types: types, rooms };
}

/**
 * Keeps only what the pasted text supports: a room whose number is not in the text is dropped, a floor or guest limit
 * that is not in the text is removed, and a type whose name is not in the text is dropped with its rooms.
 */
export function limitToSource(p: ImportProposal, source: string, existingCodes: string[]): DraftResult {
  const text = norm(source); const notes: string[] = [];
  const keptTypes = p.room_types.filter((t) => t.code && t.name && text.includes(norm(t.name)));
  const droppedTypes = p.room_types.length - keptTypes.length;
  if (droppedTypes > 0) notes.push(`${droppedTypes} room type${droppedTypes === 1 ? "" : "s"} left out because the name is not in your list.`);
  const known = new Set([...existingCodes.map((c) => c.toUpperCase()), ...keptTypes.map((t) => t.code)]);
  const digits = (n: number | undefined) => n != null && new RegExp(`(^|\\D)${n}(\\D|$)`).test(source);
  const types = keptTypes.map((t) => {
    const o: ImportType = { code: t.code, name: t.name };
    if (digits(t.max_adults)) o.max_adults = t.max_adults!;
    if (digits(t.max_children)) o.max_children = t.max_children!;
    return o;
  });
  let dropped = 0; let floorsRemoved = 0;
  const rooms: ImportRoom[] = [];
  for (const r of p.rooms) {
    // A listed range such as "101 to 110" holds rooms whose numbers are not written one by one. Accept a number that is
    // written, or that lies inside a written range.
    if (!r.number || !known.has(r.type_code) || !(text.includes(norm(r.number)) || inWrittenRange(r.number, source))) { dropped++; continue; }
    const o: ImportRoom = { number: r.number, type_code: r.type_code };
    if (r.floor) { if (text.includes(norm(r.floor))) o.floor = r.floor; else floorsRemoved++; }
    rooms.push(o);
  }
  if (dropped > 0) notes.push(`${dropped} room${dropped === 1 ? "" : "s"} left out because the number or type is not in your list.`);
  if (floorsRemoved > 0) notes.push(`${floorsRemoved} floor${floorsRemoved === 1 ? "" : "s"} removed because the floor is not in your list.`);
  if (rooms.length === 0) throw new Error("The AI draft had no rooms that match your list. Check the list, or add the rooms by hand.");
  return { proposal: { room_types: types, rooms }, notes };
}

function inWrittenRange(number: string, source: string): boolean {
  if (!/^\d+$/.test(number)) return false;
  const n = Number(number);
  for (const m of source.matchAll(/(\d+)\s*(?:to|-|–|until|through)\s*(\d+)/gi)) {
    const a = Number(m[1]); const b = Number(m[2]);
    if (a <= n && n <= b && b - a <= MAX_ROOMS) return true;
  }
  return false;
}

export async function runDraft(
  text: string, existingCodes: string[], env: BriefEnv, fetchImpl: typeof fetch = fetch,
): Promise<DraftResult> {
  const refusal = screenInput(text);
  if (refusal) throw new Error(refusal);
  if (!env.ANTHROPIC_API_KEY) throw new Error("AI is not set up yet. The platform owner needs to add the AI key.");
  const base = (env.ANTHROPIC_API_URL || "https://api.anthropic.com").replace(/\/$/, "");
  const res = await fetchImpl(`${base}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: env.AI_MODEL || "claude-haiku-4-5-20251001", max_tokens: 8000, system: SYSTEM,
      messages: [{ role: "user", content: `Existing room type codes: ${existingCodes.join(", ") || "none"}.\n\nRoom list:\n${text}` }],
    }),
  });
  if (!res.ok) throw new Error("The AI service could not read the list. Try again in a few minutes.");
  const body = (await res.json().catch(() => null)) as { content?: { type: string; text?: string }[] } | null;
  const reply = (body?.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
  if (!reply.trim()) throw new Error("The AI service returned nothing. Try again in a few minutes.");
  return limitToSource(parseProposal(reply), text, existingCodes);
}

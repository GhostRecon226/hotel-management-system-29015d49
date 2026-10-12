// Offline mode, stages 2 and 3: actions entered with no connection wait on this device and are sent when it returns.
// Only the actions in QUEUEABLE can wait. Each already carries a repeat-safe key (money) or is refused or answered
// by the database if it was already done (housekeeping, check-out, room moves), so sending one twice never repeats it.
import type { QueryClient } from "@tanstack/react-query";
import { callRpc } from "@/lib/setup";
import { errorMessage } from "@/lib/errors";
import { kvGet, kvSet } from "./store";

export const QUEUEABLE = new Set(["post_charge", "post_payment", "start_hk_task", "complete_hk_task", "check_out", "move_room", "check_in"]);
/** Reason the database records when a check-out with a balance was entered with no connection (needs fo.checkout.unsettled). */
export const OFFLINE_CHECKOUT_REASON = "Checked out with no connection";
export const QUEUED = Symbol("queued");

export type QueueEntry = {
  id: string; userId: string; name: string; args: Record<string, unknown>; label: string; createdAt: number;
  status: "waiting" | "failed"; error?: string;
  /** A refused check-in has its ID number erased from the device, so it cannot be sent again as it was. */
  idErased?: boolean;
};

const KEY = "queue";
let entries: QueueEntry[] = [];
let loaded = false;
let currentUser: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const persist = () => { void kvSet(KEY, entries); };

export const subscribeQueue = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
export const queueSnapshot = () => entries;

export async function loadQueue(userId: string) {
  currentUser = userId;
  if (loaded) return;
  loaded = true;
  const saved = (await kvGet<QueueEntry[]>(KEY)) ?? [];
  entries = [...saved, ...entries.filter((e) => !saved.some((s) => s.id === e.id))];
  emit();
}

// Pages tell the queue who an entry is about, so "Check out" in the waiting list reads "Check out 101, Ada Obi".
const hints = new Map<string, string>();
export const setLabelHint = (name: string, id: string, text: string) => { hints.set(`${name}:${id}`, text); };

/** Takes the guest's ID number and expiry out of a queued check-in. They stay on the device only until the entry is sent. */
function withoutIdNumber(args: Record<string, unknown>) {
  const reg = (args["p_registration"] ?? {}) as Record<string, unknown>;
  return { ...args, p_registration: { ...reg, id_number: "", id_expiry: null } };
}

export function labelFor(name: string, args: Record<string, unknown>) {
  const hint = hints.get(`${name}:${String(args["p_id"] ?? "")}`);
  if (hint) return hint;
  const amount = args["p_amount"] ? String(args["p_amount"]) : "";
  if (name === "post_charge") return `Charge ${amount}`.trim();
  if (name === "post_payment") return `Payment ${amount} ${String(args["p_currency"] ?? "")}`.trim();
  if (name === "start_hk_task") return "Start cleaning task";
  if (name === "complete_hk_task") return "Complete cleaning task";
  if (name === "check_out") return "Check out";
  if (name === "move_room") return "Move room";
  if (name === "check_in") return "Check in";
  return name;
}

/** True when a call failed because the network was unreachable, not because the database refused it. */
export function isNetworkError(e: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const err = e as { code?: string; message?: string; details?: string } | null;
  if (!err || (err.code && err.code !== "")) return false;
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout/i.test(`${err.message ?? ""} ${err.details ?? ""}`);
}

function enqueue(name: string, args: Record<string, unknown>) {
  if (!currentUser) throw new Error("Sign in again before saving changes.");
  // A check-out cannot ask for an approval or a reason later. The database still refuses it at send time unless the
  // person holds the right to check out with a balance, and it lands on Finance's follow-up list when a balance remains.
  if (name === "check_out" && !args["p_reason"]) args = { ...args, p_reason: OFFLINE_CHECKOUT_REASON };
  entries = [...entries, { id: crypto.randomUUID(), userId: currentUser, name, args, label: labelFor(name, args), createdAt: Date.now(), status: "waiting" }];
  persist();
  emit();
}

/** Like callRpc, but a queueable action that cannot reach the server waits on this device and returns QUEUED. */
export async function callRpcQueued<T = unknown>(name: string, args: Record<string, unknown>): Promise<T | typeof QUEUED> {
  if (!QUEUEABLE.has(name)) return callRpc<T>(name, args);
  if (typeof navigator !== "undefined" && !navigator.onLine) { enqueue(name, args); return QUEUED; }
  try {
    return await callRpc<T>(name, args);
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    enqueue(name, args); // the request may or may not have arrived; the key makes sending it again safe
    return QUEUED;
  }
}

let flushing = false;
const REFRESH = ["folios", "reservations", "housekeeping", "rooms", "checkout", "approvals", "front-desk"];

/** Sends waiting entries, oldest first. Stops at the first one that cannot reach the server. */
export async function flushQueue(queryClient: QueryClient) {
  if (flushing || !currentUser) return;
  flushing = true;
  try {
    for (const entry of [...entries]) {
      if (entry.status !== "waiting" || entry.userId !== currentUser) continue;
      try {
        await callRpc(entry.name, entry.args);
        entries = entries.filter((e) => e.id !== entry.id);
      } catch (e) {
        if (isNetworkError(e)) break;
        entries = entries.map((x) => {
          if (x.id !== entry.id) return x;
          const failed = { ...x, status: "failed" as const, error: errorMessage(e) };
          // A refused check-in must not keep the guest's ID number on the device. Staff check the guest in again online.
          return x.name === "check_in" ? { ...failed, args: withoutIdNumber(x.args), idErased: true } : failed;
        });
      }
      persist();
      emit();
    }
    REFRESH.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  } finally {
    flushing = false;
  }
}

export function retryEntry(id: string) {
  entries = entries.map((e) => {
    if (e.id !== id || e.idErased) return e;
    const { error: _drop, ...rest } = e;
    return { ...rest, status: "waiting" as const };
  });
  persist(); emit();
}
export function discardEntry(id: string) {
  entries = entries.filter((e) => e.id !== id);
  persist(); emit();
}

/** Sends now and then whenever the connection returns, and every 30 seconds while anything waits. */
export function startQueueSender(queryClient: QueryClient) {
  const run = () => { if (navigator.onLine) void flushQueue(queryClient); };
  window.addEventListener("online", run);
  const timer = setInterval(() => { if (entries.some((e) => e.status === "waiting")) run(); }, 30_000);
  run();
  return () => { window.removeEventListener("online", run); clearInterval(timer); };
}

/** True while a waiting entry of this kind is on the device for this booking. */
export const isWaitingFor = (name: string, id: string) => entries.some((e) => e.status === "waiting" && e.name === name && e.args["p_id"] === id);

export const waitingCount = () => entries.filter((e) => e.status === "waiting").length;

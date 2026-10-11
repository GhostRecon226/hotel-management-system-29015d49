// Offline mode, stage 2: actions entered with no connection wait on this device and are sent when it returns.
// Only the actions in QUEUEABLE can wait. Each already carries a repeat-safe key (money) or is refused by the
// database if it was already done (housekeeping), so sending one twice never posts twice.
import type { QueryClient } from "@tanstack/react-query";
import { callRpc } from "@/lib/setup";
import { errorMessage } from "@/lib/errors";
import { kvGet, kvSet } from "./store";

export const QUEUEABLE = new Set(["post_charge", "post_payment", "start_hk_task", "complete_hk_task"]);
export const QUEUED = Symbol("queued");

export type QueueEntry = {
  id: string; userId: string; name: string; args: Record<string, unknown>; label: string; createdAt: number;
  status: "waiting" | "failed"; error?: string;
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

export function labelFor(name: string, args: Record<string, unknown>) {
  const amount = args["p_amount"] ? String(args["p_amount"]) : "";
  if (name === "post_charge") return `Charge ${amount}`.trim();
  if (name === "post_payment") return `Payment ${amount} ${String(args["p_currency"] ?? "")}`.trim();
  if (name === "start_hk_task") return "Start cleaning task";
  if (name === "complete_hk_task") return "Complete cleaning task";
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
const REFRESH = ["folios", "reservations", "housekeeping", "rooms"];

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
        entries = entries.map((x) => (x.id === entry.id ? { ...x, status: "failed" as const, error: errorMessage(e) } : x));
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
    if (e.id !== id) return e;
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

export const waitingCount = () => entries.filter((e) => e.status === "waiting").length;

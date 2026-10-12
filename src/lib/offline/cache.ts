// Saved lists for offline mode (stage 1). Read-only copies of the lists staff use all day, kept on this device
// for the signed-in user only. Cleared on sign-out. Never includes ID numbers or ID photos: those queries are not on the list.
import { dehydrate, hydrate, type Query, type QueryClient } from "@tanstack/react-query";
import { kvClear, kvGet, kvSet } from "./store";

const KEY = "lists";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** The only lists saved. Each entry is the start of a query key. */
const SAVED: unknown[][] = [
  ["my-context"],
  ["reservations", "fd", "arrivals"],
  ["reservations", "fd", "in-house"],
  ["rooms", "board"],
  ["housekeeping", "tasks"],
  ["folios", "list"],
  ["folios", "one"],
  ["folios", "tx"],
  ["setup", "charge_codes"],
  ["setup", "payment_methods"],
  ["setup", "exchange_rates"],
];

export function isSavedList(key: readonly unknown[]) {
  return SAVED.some((prefix) => prefix.every((part, i) => key[i] === part));
}

let savingFor: string | null = null;
let restoredFor: string | null = null;
/** Tells the saver whose lists these are. Called when the signed-in user is known. */
export function rememberUser(userId: string | null) { savingFor = userId; if (!userId) restoredFor = null; }
export const currentSavingUser = () => savingFor;

type Saved = { userId: string; savedAt: number; state: ReturnType<typeof dehydrate> };

/** Puts the saved lists back into the app's cache. Only for the same user, and only if recent. */
export async function restoreSavedLists(queryClient: QueryClient, userId: string) {
  if (restoredFor === userId) return true; // once per page load; newer data in memory is never overwritten
  restoredFor = userId;
  const saved = await kvGet<Saved>(KEY);
  if (!saved || saved.userId !== userId || Date.now() - saved.savedAt > MAX_AGE_MS) return false;
  hydrate(queryClient, saved.state);
  return true;
}

/** Saves the lists after they change (at most once every two seconds). Returns a function that stops saving. */
export function startSavingLists(queryClient: QueryClient, getUserId: () => string | null) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = async () => {
    timer = null;
    const userId = getUserId();
    if (!userId) return;
    const state = dehydrate(queryClient, {
      shouldDehydrateQuery: (q: Query) => q.state.status === "success" && isSavedList(q.queryKey),
    });
    if (state.queries.length === 0) return;
    await kvSet(KEY, { userId, savedAt: Date.now(), state } satisfies Saved);
  };
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || !isSavedList(event.query.queryKey)) return;
    if (event.action.type !== "success") return;
    if (!timer) timer = setTimeout(save, 2000);
  });
  return () => { unsubscribe(); if (timer) clearTimeout(timer); };
}

/** When the newest saved list was loaded, for the banner. */
export function newestListTime(queryClient: QueryClient): number | null {
  let newest = 0;
  for (const q of queryClient.getQueryCache().getAll()) {
    if (isSavedList(q.queryKey) && q.state.dataUpdatedAt > newest) newest = q.state.dataUpdatedAt;
  }
  return newest || null;
}

/** Sign-out: remove everything saved on this device. */
export async function clearOfflineData() {
  await kvClear();
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    reg?.active?.postMessage({ type: "clear" });
  } catch { /* nothing to clear */ }
}

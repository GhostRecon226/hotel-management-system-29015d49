import { useSyncExternalStore } from "react";
import { queueSnapshot, subscribeQueue } from "./queue";

/** The entries waiting on this device, kept current as the queue changes. */
export function useQueueEntries() {
  return useSyncExternalStore(subscribeQueue, queueSnapshot, queueSnapshot);
}

/** True while an entry of this kind waits to be sent for this booking (so the screen does not offer it twice). */
export function useWaitingFor(name: string, id: string) {
  return useQueueEntries().some((e) => e.status === "waiting" && e.name === name && e.args["p_id"] === id);
}

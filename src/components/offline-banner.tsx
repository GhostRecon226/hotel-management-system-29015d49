import { useQueryClient, onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { newestListTime } from "@/lib/offline/cache";

function useOnline() {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  );
}

/** A bar across the top while the device has no connection. Lists on screen are the last saved copy. */
export function OfflineBanner() {
  const online = useOnline();
  const qc = useQueryClient();
  if (online) return null;
  const at = newestListTime(qc);
  const when = at ? new Intl.DateTimeFormat("en-NG", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }).format(new Date(at)) : null;
  return (
    <div role="status" className="flex items-center gap-2 border-b border-border bg-warning-soft px-4 py-2 text-sm text-warning-strong print:hidden">
      <WifiOff className="size-4 shrink-0" aria-hidden />
      <span>
        <strong>No connection.</strong>{" "}
        {when ? `Lists show the last saved copy from ${when}. ` : "Lists show the last saved copy. "}
        Changes cannot be saved until the connection returns.
      </span>
    </div>
  );
}

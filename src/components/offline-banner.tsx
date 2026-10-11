import { useQueryClient } from "@tanstack/react-query";
import { useState, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { newestListTime } from "@/lib/offline/cache";
import { discardEntry, flushQueue, queueSnapshot, retryEntry, subscribeQueue } from "@/lib/offline/queue";

// The browser's own online flag. TanStack's onlineManager only changes on a switch event, so a page that
// opens while already offline would still read "online".
function useOnline() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
    },
    () => navigator.onLine,
    () => true,
  );
}

function useQueue() {
  return useSyncExternalStore(subscribeQueue, queueSnapshot, queueSnapshot);
}

/** A bar across the top while the device has no connection, or while entries wait to be sent. */
export function OfflineBanner() {
  const online = useOnline();
  const qc = useQueryClient();
  const queue = useQueue();
  const [open, setOpen] = useState(false);
  const waiting = queue.filter((e) => e.status === "waiting").length;
  const failed = queue.filter((e) => e.status === "failed").length;
  if (online && queue.length === 0) return null;
  const at = newestListTime(qc);
  const when = at ? new Intl.DateTimeFormat("en-NG", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }).format(new Date(at)) : null;
  return (
    <>
      <div role="status" className="flex flex-wrap items-center gap-2 border-b border-border bg-warning-soft px-4 py-2 text-sm text-warning-strong print:hidden">
        {!online && <WifiOff className="size-4 shrink-0" aria-hidden />}
        <span>
          {!online && <><strong>No connection.</strong>{" "}{when ? `Lists show the last saved copy from ${when}. ` : "Lists show the last saved copy. "}</>}
          {waiting > 0 && <strong>{waiting} waiting to send. </strong>}
          {failed > 0 && <strong>{failed} need attention. </strong>}
          {!online && waiting === 0 && failed === 0 && "Changes cannot be saved until the connection returns."}
        </span>
        {queue.length > 0 && <Button size="sm" variant="outline" className="ml-auto" onClick={() => setOpen(true)}>View</Button>}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Waiting to send</DialogTitle></DialogHeader>
          {queue.length === 0 && <p className="text-sm text-muted-foreground">Nothing is waiting.</p>}
          <ul className="divide-y rounded-md border">
            {queue.map((e) => (
              <li key={e.id} className="space-y-1 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{e.label}</span>
                  <span className="text-muted-foreground">{e.status === "waiting" ? "Waiting to send" : "Needs attention"}</span>
                </div>
                {e.error && <p className="text-danger-strong">{e.error}</p>}
                <div className="text-xs text-muted-foreground">Entered {new Date(e.createdAt).toLocaleString("en-NG")}</div>
                {e.status === "failed" && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => { retryEntry(e.id); void flushQueue(qc); }}>Try again</Button>
                    <Button size="sm" variant="ghost" onClick={() => discardEntry(e.id)}>Remove</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Entries send by themselves when the connection returns. A charge or payment is posted once, even if it is sent twice.</p>
        </DialogContent>
      </Dialog>
    </>
  );
}

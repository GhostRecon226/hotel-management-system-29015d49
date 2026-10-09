import { useState } from "react";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, formatDay } from "@/lib/reservations";
import { useSupportRequest, useSupportRequests, useSupportSnapshot } from "@/lib/platform";
import { SUPPORT_STATUS } from "@/components/admin/support-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Platform console, one hotel: ask for support access and, once the hotel allows it, read the account snapshot.
export function SupportSection({ tenantId }: { tenantId: string }) {
  const reqs = useSupportRequests(tenantId);
  const ask = useSupportRequest(tenantId);
  const snap = useSupportSnapshot(tenantId);
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState("24");
  const open = reqs.data?.find((r) => r.status === "requested" || r.status === "granted");
  const h = Number(hours);
  const ready = reason.trim() !== "" && Number.isInteger(h) && h >= 1 && h <= 72;

  return (
    <section aria-labelledby="sup-title" className="space-y-3">
      <h3 id="sup-title" className="font-semibold">Support access</h3>
      {!open && (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); ask.mutate({ reason: reason.trim(), hours: h }, { onSuccess: () => setReason("") }); }}>
          <Textarea aria-label="Why you need access" placeholder="Why do you need to look at this account?" rows={2} maxLength={500}
            value={reason} onChange={(e) => setReason(e.target.value)} required />
          <div className="flex items-center gap-2">
            <Input aria-label="Hours" type="number" min={1} max={72} className="w-24" value={hours} onChange={(e) => setHours(e.target.value)} />
            <span className="text-sm text-muted-foreground">hours asked for (1 to 72)</span>
            <Button type="submit" size="sm" disabled={!ready || ask.isPending}>Ask the hotel</Button>
          </div>
        </form>
      )}
      <ul className="space-y-2">
        {reqs.data?.map((r) => {
          const s = SUPPORT_STATUS[r.status] ?? { label: r.status, tone: "neutral" as const };
          return (
            <li key={r.id} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={s.tone} dot>{r.status === "requested" ? "Waiting for the hotel" : s.label}</Badge>
                <span className="text-muted-foreground">{formatDateTime(r.requested_at)}</span>
              </div>
              <p className="mt-1">{r.reason}</p>
              {r.status === "granted" && r.expires_at && <p className="text-muted-foreground">Allowed until {formatDateTime(r.expires_at)} · {r.views} views</p>}
            </li>
          );
        })}
        {reqs.data?.length === 0 && <li className="text-sm text-muted-foreground">No requests yet.</li>}
      </ul>
      {open?.status === "granted" && (
        <div className="space-y-3">
          <Button size="sm" onClick={() => snap.mutate()} disabled={snap.isPending}>{snap.data ? "Refresh view" : "Open support view"}</Button>
          <p className="text-sm text-muted-foreground">Each time you open it, the hotel's audit log records a view.</p>
          {snap.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(snap.error)}</p>}
          {snap.data && (
            <div className="space-y-4 rounded-md border p-3 text-sm">
              <p>Plan {snap.data.hotel.plan_code} · {snap.data.hotel.subscription_status}
                {snap.data.hotel.paid_until ? ` · paid until ${formatDay(snap.data.hotel.paid_until)}` : ""}
                {snap.data.hotel.trial_ends_at ? ` · trial ends ${formatDay(snap.data.hotel.trial_ends_at)}` : ""}</p>
              {snap.data.properties.map((p) => (
                <p key={p.name}>{p.name}: {p.rooms} rooms, {p.active_staff} active staff, business date {formatDay(p.business_date)}, {p.timezone}</p>
              ))}
              <p>Messages: {snap.data.messages.pending} waiting, {snap.data.messages.failed} failed, {snap.data.messages.sent_last_24h} sent in the last 24 hours.</p>
              <div>
                <p className="font-medium">Recent daily rollovers</p>
                {snap.data.business_date_runs.length === 0 && <p className="text-muted-foreground">None yet.</p>}
                <ul className="mt-1 space-y-1">
                  {snap.data.business_date_runs.map((r, i) => (
                    <li key={i}>{r.property}: {formatDay(r.from_date)} to {formatDay(r.to_date)}, {r.status}, {formatDateTime(r.finished_at)}{r.error ? ` · ${r.error}` : ""}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

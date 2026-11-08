import { useQuery } from "@tanstack/react-query";
import { useAccess } from "@/lib/access";
import { useAdminUsers, useSubscriptionInfo } from "@/lib/admin";
import { callRpc } from "@/lib/setup";
import { formatDay } from "@/lib/reservations";
import { cn } from "@/lib/utils";

type Tone = "ok" | "warn" | "bad" | "plain";
const RING: Record<Tone, string> = { ok: "border-border", plain: "border-border", warn: "border-warning/60 bg-warning-soft/40", bad: "border-danger/60 bg-danger-soft/50" };

function Box({ label, value, sub, tone = "plain", to, onOpen }: { label: string; value: string; sub: string; tone?: Tone; to: string; onOpen: (tab: string) => void }) {
  return (
    <button type="button" onClick={() => onOpen(to)} className={cn("min-h-11 rounded-xl border bg-card p-3 text-left shadow-card transition-shadow hover:shadow-raised focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40", RING[tone])}>
      <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="mt-0.5 block text-xl font-bold leading-tight tabular">{value}</span>
      <span className="block text-[13px] text-muted-foreground">{sub}</span>
    </button>
  );
}

/** Four boxes at the top of Admin: staff, plan, business date and messages. Each shows only to people who may open that area. */
export function AdminHealth({ onOpen }: { onOpen: (tab: string) => void }) {
  const { can, canAny, property } = useAccess();
  const seeUsers = can("adm.user.manage");
  const seePlan = canAny(["adm.subscription.manage", "adm.user.manage"]);
  const seeDate = canAny(["fin.nightaudit.run", "adm.audit.view"]);
  const users = useAdminUsers(seeUsers);
  const sub = useSubscriptionInfo(seePlan);
  const roll = useQuery({
    queryKey: ["admin", "roll-status", property?.id], enabled: seeDate && !!property,
    queryFn: () => callRpc<{ business_date: string; rollover_time: string; is_due: boolean }>("rollover_status", { p_property_id: property!.id }),
  });
  const outbox = useQuery({ queryKey: ["outbox", "status"], enabled: seeUsers, queryFn: () => callRpc<{ pending: number; sent: number; failed: number }>("outbox_status", {}) });

  const boxes: React.ReactNode[] = [];
  if (seeUsers && users.data) {
    const active = users.data.filter((u) => u.status === "active");
    const waiting = active.filter((u) => !u.last_sign_in_at).length;
    boxes.push(<Box key="u" label="Active staff" value={String(active.length)} sub={waiting > 0 ? `${waiting} not signed in yet` : "All have signed in"} to="users" onOpen={onOpen} />);
  }
  if (seePlan && sub.data) {
    const s = sub.data;
    const left = s.trial_days_left;
    const trial = s.status === "trial" && left != null;
    const bad = s.status === "past_due" || s.status === "suspended" || !s.writable;
    boxes.push(<Box key="p" label="Plan" value={s.plan_name}
      sub={trial ? `Free trial, ${left} ${left === 1 ? "day" : "days"} left` : s.status === "active" ? "Active" : s.status.replace("_", " ")}
      tone={bad ? "bad" : trial && left < 14 ? "warn" : "plain"} to="plan" onOpen={onOpen} />);
  }
  if (seeDate && roll.data) {
    boxes.push(<Box key="d" label="Business date" value={formatDay(roll.data.business_date)}
      sub={roll.data.is_due ? "Roll is due now" : `Rolls at ${roll.data.rollover_time.slice(0, 5)}`} tone={roll.data.is_due ? "warn" : "plain"} to="date" onOpen={onOpen} />);
  }
  if (seeUsers && outbox.data) {
    const f = outbox.data.failed;
    boxes.push(<Box key="m" label="Messages" value={f > 0 ? `${f} failed` : "0 failed"} sub={`${outbox.data.pending} waiting to send`} tone={f > 0 ? "bad" : "plain"} to="outbox" onOpen={onOpen} />);
  }
  if (boxes.length === 0) return null;
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Health of your hotel account">{boxes}</div>;
}

import { useAccess } from "@/lib/access";
import { NoAccess, SectionHeader } from "@/lib/setup";
import { formatDateTime } from "@/lib/reservations";
import { useSubscriptionInfo } from "@/lib/admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type BadgeTone = "success" | "warning" | "danger" | "neutral" | "info";

const STATUS: Record<string, { label: string; variant: BadgeTone }> = {
  trial: { label: "Free trial", variant: "info" },
  trialing: { label: "On trial", variant: "info" },
  active: { label: "Active", variant: "success" },
  past_due: { label: "Payment overdue", variant: "warning" },
  expired: { label: "Expired", variant: "danger" },
  suspended: { label: "Suspended", variant: "danger" },
  cancelled: { label: "Cancelled", variant: "neutral" },
};

export function SubscriptionPanel() {
  const { can } = useAccess();
  const allowed = can("adm.subscription.manage") || can("adm.user.manage");
  const info = useSubscriptionInfo(allowed);

  if (!allowed) return <NoAccess />;
  if (info.isLoading) return <LoadingState />;
  const s = info.data;
  if (!s) return null;
  const st = STATUS[s.status] ?? { label: s.status, variant: "neutral" as const };

  const line = (label: string, value: string) => (
    <div><div className="text-sm text-muted-foreground">{label}</div><div className="text-[15px] font-medium">{value}</div></div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <SectionHeader title="Your plan" description="What your hotel is signed up to, and how much of it you are using." />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {line("Hotel", s.tenant_name)}
            {line("Plan", s.plan_name)}
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <div className="mt-0.5"><Badge variant={st.variant} dot>{st.label}</Badge></div>
            </div>
            {line("Trial ends", s.trial_ends_at ? `${formatDateTime(s.trial_ends_at)}${s.trial_days_left != null ? ` (${s.trial_days_left} days left)` : ""}` : "—")}
          </div>
          {!s.writable && (
            <p className="mt-4 rounded-xl border border-destructive/30 bg-danger-soft px-4 py-2.5 text-sm text-danger-strong">
              Your hotel is read-only. You can still settle bills and check guests out, but nothing new can be added until the subscription is active again.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <SectionHeader title="Limits" description="Adding more than your plan allows is blocked." />
          <Table>
            <TableHeader><TableRow>
              <TableHead>Item</TableHead><TableHead className="text-right">In use</TableHead><TableHead className="text-right">Allowed</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {([["Rooms", s.usage.rooms, s.limits.rooms], ["Properties", s.usage.properties, s.limits.properties], ["Staff", s.usage.users, s.limits.users]] as const).map(([label, used, max]) => (
                <TableRow key={label}>
                  <TableCell className="font-medium">{label}</TableCell>
                  <TableCell className="tabular text-right">{used}</TableCell>
                  <TableCell className="tabular text-right">{max == null ? "No limit" : max}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <SectionHeader title="Other plans" description="To change plan, contact us. Plans are not changed from inside the app yet." />
          <Table>
            <TableHeader><TableRow>
              <TableHead>Plan</TableHead><TableHead className="text-right">Rooms</TableHead>
              <TableHead className="text-right">Properties</TableHead><TableHead className="text-right">Staff</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {s.plans.map((p) => (
                <TableRow key={p.code} className={p.code === s.plan_code ? "bg-muted/50" : undefined}>
                  <TableCell className="font-medium">{p.name}{p.code === s.plan_code && <Badge variant="success" className="ml-2">Current</Badge>}</TableCell>
                  <TableCell className="tabular text-right">{p.max_rooms ?? "No limit"}</TableCell>
                  <TableCell className="tabular text-right">{p.max_properties ?? "No limit"}</TableCell>
                  <TableCell className="tabular text-right">{p.max_users ?? "No limit"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

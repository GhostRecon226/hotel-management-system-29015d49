import { AlertTriangle, Clock, Lock } from "lucide-react";
import { useAccess } from "@/lib/access";

export function SubscriptionBanner() {
  const { ctx } = useAccess();
  const status = ctx.tenant?.status;
  const days = ctx.subscription?.trial_days_left;

  if (status === "expired" || status === "suspended") {
    return (
      <div className="flex items-center gap-2 border-b bg-destructive px-4 py-2 text-sm text-destructive-foreground" role="alert">
        <Lock className="h-4 w-4 shrink-0" />
        Your subscription is {status}. The hotel is read-only; you can still settle bills and check guests out.
      </div>
    );
  }
  if (status === "past_due") {
    return (
      <div className="flex items-center gap-2 border-b bg-warning px-4 py-2 text-sm text-warning-foreground" role="alert">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Your payment is past due. Please pay soon to avoid the hotel becoming read-only.
      </div>
    );
  }
  if (status === "trial" && days != null) {
    return (
      <div className="flex items-center gap-2 border-b bg-accent px-4 py-2 text-sm text-accent-foreground">
        <Clock className="h-4 w-4 shrink-0" />
        {days === 0 ? "Your free trial ends today." : `${days} day${days === 1 ? "" : "s"} left on your free trial.`}
      </div>
    );
  }
  return null;
}

import { AlertTriangle, Clock, Lock } from "lucide-react";
import { useAccess } from "@/lib/access";

export function SubscriptionBanner() {
  const { ctx } = useAccess();
  const status = ctx.tenant?.status;
  const days = ctx.subscription?.trial_days_left;

  if (status === "expired" || status === "suspended") {
    return (
      <div className="flex items-center gap-2 border-b border-destructive/30 bg-danger-soft px-5 py-2.5 text-[15px] font-medium text-danger-strong" role="alert">
        <Lock className="h-5 w-5 shrink-0" />
        Your subscription is {status}. The hotel is read-only; you can still settle bills and check guests out.
      </div>
    );
  }
  if (status === "past_due") {
    return (
      <div className="flex items-center gap-2 border-b border-warning/40 bg-warning-soft px-5 py-2.5 text-[15px] font-medium text-warning-strong" role="alert">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        Your payment is past due. Please pay soon to avoid the hotel becoming read-only.
      </div>
    );
  }
  if (status === "trial" && days != null) {
    return (
      <div className="flex items-center gap-2 border-b border-info/30 bg-info-soft px-5 py-2.5 text-[15px] text-info-strong">
        <Clock className="h-5 w-5 shrink-0" />
        {days === 0 ? "Your free trial ends today." : `${days} day${days === 1 ? "" : "s"} left on your free trial.`}
      </div>
    );
  }
  return null;
}

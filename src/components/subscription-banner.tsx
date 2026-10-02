import { AlertTriangle, Clock, Lock, Sparkles as Sparkle } from "lucide-react";
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
  // On wide screens the trial shows as a card in the sidebar (TrialCard); here only when the sidebar is hidden.
  if (status === "trial" && days != null) {
    return (
      <div className="flex items-center gap-2 border-b border-info/30 bg-info-soft px-5 py-2 text-sm text-info-strong lg:hidden">
        <Clock className="h-4 w-4 shrink-0" />
        {trialText(days)}
      </div>
    );
  }
  return null;
}

function trialText(days: number) {
  return days === 0 ? "Your free trial ends today." : `${days} day${days === 1 ? "" : "s"} left on your free trial.`;
}

/** Trial notice in the sidebar, in the style of an upgrade card. Information only: activation is done by us (decision 5e). */
export function TrialCard() {
  const { ctx } = useAccess();
  const days = ctx.subscription?.trial_days_left;
  if (ctx.tenant?.status !== "trial" || days == null) return null;
  return (
    <div className="relative overflow-hidden rounded-xl bg-accent-fill p-4 text-primary-foreground shadow-accent">
      <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-white/10" />
      <Sparkle className="relative size-5 text-on-primary-muted" aria-hidden />
      <p className="relative mt-2 text-[15px] font-bold">Free trial</p>
      <p className="relative mt-0.5 text-[13px] leading-snug text-on-primary-muted">{trialText(days)}</p>
    </div>
  );
}

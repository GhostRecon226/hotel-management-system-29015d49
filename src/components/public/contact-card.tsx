import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Contact card (our own): icon, label, the detail. */
export function ContactCard({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-border/70 bg-card p-5 shadow-card">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-strong" aria-hidden><Icon className="size-5" /></span>
      <div className="min-w-0">
        <h2 className="text-sm font-bold">{label}</h2>
        <div className="mt-1 text-[15px] text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

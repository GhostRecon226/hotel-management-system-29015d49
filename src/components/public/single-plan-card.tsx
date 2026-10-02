import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/*
 * One centred plan card: headline instead of a price, a checklist, short trust notes and the call to action.
 * Layout based on "Single Plan Pricing Card" (pricing-17) by LN (lndev-ui) on 21st.dev (MIT licence).
 * Rebuilt for Hotel Desk with the tokens in src/theme.css; no code copied. No prices: plan tiers are not decided (A16).
 */
export function SinglePlanCard({ title, lead, includes, notes }: { title: string; lead: ReactNode; includes: string[]; notes: string[] }) {
  return (
    <div className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-border/70 bg-card shadow-raised">
      <div className="bg-accent-fill px-6 py-8 text-center text-primary-foreground sm:px-10">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
        <p className="mt-2 text-[15px] text-on-primary-muted">{lead}</p>
      </div>
      <div className="px-6 py-7 sm:px-10">
        <h3 className="text-sm font-bold">The trial includes</h3>
        <ul className="mt-3 space-y-2.5">
          {includes.map((i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success-soft text-success-strong" aria-hidden><Check className="size-3.5" /></span>
              {i}
            </li>
          ))}
        </ul>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Button asChild size="lg"><Link to="/auth">Start free trial</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/contact">Contact us</Link></Button>
        </div>
        <ul className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Good to know">
          {notes.map((n) => <li key={n} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">{n}</li>)}
        </ul>
      </div>
    </div>
  );
}

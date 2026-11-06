import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/plan-list";
import { cn } from "@/lib/utils";

/* The three plan cards, shared by the home page and the Pricing page. Prices come from src/lib/plan-list.ts. */
export function PlanCards({ billing, reveal, showAlternative }: { billing: "month" | "year"; reveal?: boolean; showAlternative?: boolean }) {
  return (
    <div className="mx-auto mt-8 grid max-w-5xl gap-5 md:grid-cols-3">
      {PLANS.map((p, i) => {
        const star = p.name === "Standard";
        return (
          <section key={p.name} {...(reveal ? { "data-reveal": "" } : {})} style={{ "--i": i } as React.CSSProperties} className={cn("mer-lift flex flex-col rounded-2xl border p-7", star ? "border-transparent bg-accent-fill text-primary-foreground shadow-accent" : "border-border/70 bg-card shadow-card")}>
            <h3 className="font-sans text-lg font-bold">{p.name}</h3>
            <p className="mt-4 text-4xl font-extrabold tracking-tight tabular">
              {billing === "month" ? p.price : p.year}
              <span className={cn("text-sm font-medium", star ? "text-on-primary-muted" : "text-muted-foreground")}> {billing === "month" ? "a month" : "a year"}</span>
            </p>
            {showAlternative && <p className={cn("mt-1 text-sm", star ? "text-on-primary-muted" : "text-muted-foreground")}>{billing === "month" ? `or ${p.year} a year, two months free` : `Same as ${p.price} a month for 10 months`}</p>}
            <ul className={cn("mt-6 space-y-3 border-t pt-6 text-[15px]", star ? "border-white/20 text-on-primary-muted" : "border-border/70 text-muted-foreground")}>
              {p.limits.map((l) => <li key={l} className="flex gap-2.5"><Check aria-hidden className={cn("mt-0.5 size-4 shrink-0", star ? "text-primary-foreground" : "text-success-strong")} />{l}</li>)}
            </ul>
            <Button asChild variant={star ? "secondary" : "outline"} className="mt-7 w-full"><Link to="/auth" search={{ mode: "signup" }}>Start free trial</Link></Button>
          </section>
        );
      })}
    </div>
  );
}

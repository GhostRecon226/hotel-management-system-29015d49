import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Badge } from "@/components/ui/badge";

/*
 * Sample screen on the sign-in brand panel. Sample Hotel data only; nothing here calls a database.
 * Figures agree with the home page hero (20 rooms, 15 sold, 75%). Hidden from screen readers except for one label.
 */
const TILES = [
  { label: "Occupancy", value: "75%", note: "15 of 20 rooms" },
  { label: "Arrivals", value: "3", note: "Waiting to check in" },
  { label: "Departures", value: "2", note: "Bills to settle" },
];
const ROWS: { guest: string; room: string; status: string }[] = [
  { guest: "Guest A", room: "Room 106 · Deluxe", status: "Confirmed" },
  { guest: "Guest B", room: "Room 104 · Standard", status: "Confirmed" },
];

function SamplePanel() {
  return (
    <div className="hs-settle overflow-hidden rounded-2xl border border-border/70 bg-card text-card-foreground shadow-raised" role="img"
      aria-label="Sample Zikora home screen showing occupancy, arrivals and departures. Sample data.">
      <div className="flex items-center gap-2 border-b border-border/70 bg-muted/50 px-4 py-2.5" aria-hidden>
        <span className="text-xs font-semibold">Sample Hotel · 20 rooms</span>
        <Badge variant="neutral" className="ml-auto">Sample Data</Badge>
      </div>
      <div className="p-4" aria-hidden>
        <div className="grid grid-cols-3 gap-2.5">
          {TILES.map((t) => (
            <div key={t.label} className="rounded-xl border border-border/70 bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight tabular">{t.value}</p>
              <p className="text-xs text-muted-foreground">{t.note}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border border-border/70">
          {ROWS.map((r, i) => (
            <div key={r.guest} className={`grid grid-cols-[1fr_1.4fr_auto] items-center gap-3 px-3 py-2 text-xs ${i ? "border-t border-border/70" : ""}`}>
              <span className="font-semibold">{r.guest}</span><span className="text-muted-foreground">{r.room}</span><Badge variant="success">{r.status}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Sign-in, sign-up and first-time setup layout (Meridian look, Nov 2026): two rounded cards on a soft background.
 * The brand panel shows the lobby photo public/brand/login-hero.jpg under a dark teal wash (`.auth-hero` in src/theme.css)
 * with a sample screen on it, and hides on small screens.
 */
export function AuthLayout({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="grid min-h-dvh gap-4 bg-muted/60 p-3 sm:p-5 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
      <aside className="auth-hero relative hidden flex-col justify-between overflow-hidden rounded-3xl p-10 text-white shadow-raised lg:flex xl:p-12 gap-8">
        <BrandLogo variant="login" onDark className="relative h-12 w-auto self-start" />
        <div className="relative">
          <h2 className="font-sans text-balance max-w-md text-4xl font-extrabold leading-[1.1] tracking-tight">Know what’s happening in your hotel.</h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/80">
            One connected system for reservations, front desk, housekeeping, maintenance and the hotel’s financial records.
          </p>
          <div className="mt-8 max-w-xl"><SamplePanel /></div>
        </div>
        <p className="relative mt-8 text-xs uppercase tracking-[0.3em] text-white/70">Hotel operations. Clearer control.</p>
      </aside>
      <main className="flex items-center justify-center rounded-3xl bg-background px-4 py-10 shadow-card sm:px-8">
        <div className={wide ? "w-full max-w-lg" : "w-full max-w-md"}>
          <div className="mb-8 flex items-center justify-between gap-4">
            <BrandLogo variant="login" className="h-11 w-auto lg:h-12" />
            <Link to="/" className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40">
              <ArrowLeft className="size-4" aria-hidden />Back to site
            </Link>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

import type { ReactNode } from "react";
import { BarChart3, BedDouble, CalendarDays, ConciergeBell } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

const FEATURES = [
  { icon: CalendarDays, title: "Reservations", text: "Bookings, holds and groups in one place" },
  { icon: ConciergeBell, title: "Front desk", text: "Arrivals, walk-ins and departures" },
  { icon: BedDouble, title: "Rooms", text: "Room status, housekeeping and maintenance" },
  { icon: BarChart3, title: "Reports", text: "Daily figures and outstanding balances" },
];

/**
 * Two-column layout for sign-in, sign-up and first-time setup. The brand panel hides on small screens.
 * The panel shows the lobby photo public/brand/login-hero.jpg under a dark teal wash (`.auth-hero` in src/theme.css).
 */
export function AuthLayout({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
      <aside className="auth-hero relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <BrandLogo variant="login" onDark className="relative h-14 w-auto self-start" />
        <div className="relative max-w-md">
          <h2 className="text-5xl font-semibold leading-[1.1]">Know what’s happening in your hotel.</h2>
          <p className="mt-5 text-base leading-relaxed text-white/80">
            One connected system for reservations, front desk, housekeeping, maintenance and the hotel’s financial records.
          </p>
          <ul className="mt-9 space-y-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-center gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15" aria-hidden>
                  <Icon className="size-5 text-white" />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold">{title}</span>
                  <span className="block text-sm text-white/75">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs uppercase tracking-[0.3em] text-white/70">Hotel operations. Clearer control.</p>
      </aside>
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className={wide ? "w-full max-w-lg" : "w-full max-w-md"}>
          <BrandLogo variant="login" className="mb-8 h-12 w-auto self-start lg:h-14" />
          {children}
        </div>
      </main>
    </div>
  );
}

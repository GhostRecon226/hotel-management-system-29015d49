import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { HotelAtNight } from "@/components/auth-night";

/**
 * Sign-in, sign-up and first-time setup layout (Meridian look, Nov 2026): two rounded cards on a very light background.
 * The left card is a dark panel with the hotel-at-night drawing (src/components/auth-night.tsx, `.auth-night` in src/theme.css).
 * The right card is white and carries the form. The left card hides on small screens, where the logo moves to the form card.
 */
export function AuthLayout({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="grid min-h-dvh gap-4 bg-primary-tint p-3 sm:p-5 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
      <aside className="auth-night relative hidden flex-col justify-between gap-8 overflow-hidden rounded-3xl p-10 text-white lg:flex xl:p-12">
        <BrandLogo variant="login" onDark className="relative h-12 w-auto self-start" />
        <div className="relative flex flex-1 items-center justify-center py-4"><HotelAtNight /></div>
        <div className="relative">
          <h2 className="font-sans text-balance max-w-md text-4xl font-extrabold leading-[1.1] tracking-tight">Know what’s happening in your hotel.</h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/80">
            One connected system for reservations, front desk, housekeeping, maintenance and the hotel’s financial records.
          </p>
        </div>
      </aside>
      <main className="flex items-center justify-center rounded-3xl border border-border/60 bg-card px-4 py-10 sm:px-8">
        <div className={wide ? "w-full max-w-lg" : "w-full max-w-md"}>
          <div className="mb-8 flex items-center justify-between gap-4">
            <BrandLogo variant="login" className="h-11 w-auto lg:hidden" />
            <Link to="/" className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 lg:ml-0 ml-auto">
              <ArrowLeft className="size-4" aria-hidden />Back to site
            </Link>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

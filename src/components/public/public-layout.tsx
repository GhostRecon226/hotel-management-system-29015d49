import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { hasStoredSession } from "@/lib/session-hint";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/features", label: "Features" },
  { to: "/pricing", label: "Pricing" },
  { to: "/security", label: "Security" },
  { to: "/faq", label: "FAQ" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

/** Header and footer for the public pages. Static: no database calls. */
export function PublicLayout({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => setSignedIn(hasStoredSession()), []);
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a href="#main" className="sr-only rounded-lg bg-card px-4 py-2 font-semibold text-primary-strong focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:shadow-raised">
        Skip to content
      </a>
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
            <BrandLogo className="h-9 w-auto" />
          </Link>
          <nav aria-label="Main" className="order-3 -mx-2 flex w-full gap-1 overflow-x-auto sm:order-none sm:mx-0 sm:w-auto">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to}
                className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
                activeProps={{ className: "bg-primary-soft !text-primary-strong" }}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {signedIn
              ? <Button asChild size="sm"><Link to="/dashboard">Open the app</Link></Button>
              : <>
                  <Button asChild size="sm" variant="outline"><Link to="/auth">Sign in</Link></Button>
                  <Button asChild size="sm" className="hidden sm:inline-flex"><Link to="/auth">Start free trial</Link></Button>
                </>}
          </div>
        </div>
      </header>
      <main id="main" className="flex-1">{children}</main>
      <footer className="border-t border-border/70 bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))] sm:px-6">
          <div>
            <div className="flex items-center gap-2.5">
              <BrandLogo className="h-8 w-auto" />
            </div>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">Hotel management software built in Africa, for independent hotels. Know every payment that comes through your front desk.</p>
          </div>
          <FooterLinks title="Product" links={[{ to: "/", label: "Home" }, { to: "/features", label: "Features" }, { to: "/pricing", label: "Pricing" }, { to: "/security", label: "Security" }, { to: "/faq", label: "FAQ" }]} />
          <FooterLinks title="Company" links={[{ to: "/about", label: "About" }, { to: "/contact", label: "Contact" }, { to: "/privacy", label: "Privacy notice" }, { to: "/terms", label: "Terms of use" }]} />
        </div>
      </footer>
    </div>
  );
}

type FooterLink = { to: "/" | "/features" | "/security" | "/pricing" | "/faq" | "/about" | "/contact" | "/privacy" | "/terms"; label: string };
function FooterLinks({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h2 className="text-sm font-bold">{title}</h2>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.to}><Link to={l.to} className="text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:underline">{l.label}</Link></li>
        ))}
      </ul>
    </div>
  );
}

/** Page width and spacing for public sections. */
export function Section({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20", className)}>{children}</section>;
}

/** Small label above a heading. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary-soft px-3 py-1 text-xs font-semibold text-primary-strong">{children}</span>;
}

/** Notice shown on draft legal pages. */
export function DraftNotice() {
  return (
    <p role="note" className="mb-8 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm font-semibold text-warning-strong">
      Draft, pending legal review. This text may change before it is final.
    </p>
  );
}

import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { hasStoredSession } from "@/lib/session-hint";
import { BrandLogo } from "@/components/brand-logo";
import { SITE_INFO } from "@/lib/site-info";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/features", label: "Features" },
  { to: "/security", label: "Security" },
  { to: "/pricing", label: "Pricing" },
  { to: "/faq", label: "FAQ" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

/** Header and footer for the public pages. Static: no database calls. */
export function PublicLayout({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const home = useRouterState({ select: (st) => st.location.pathname === "/" });
  useEffect(() => setSignedIn(hasStoredSession()), []);
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a href="#main" className="sr-only rounded-lg bg-card px-4 py-2 font-semibold text-primary-strong focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:shadow-raised">
        Skip to content
      </a>
      {home ? <HomeHeader signedIn={signedIn} /> : (
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-x-6 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
            <BrandLogo className="h-9 w-auto" />
          </Link>
          <nav aria-label="Main" className="hidden gap-1 lg:flex">
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
                  <Button asChild size="sm" className="hidden sm:inline-flex"><Link to="/auth" search={{ mode: "signup" }}>Start free trial</Link></Button>
                </>}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu"><Menu className="size-5" /></Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <nav aria-label="Menu" className="mt-8 flex flex-col gap-1">
                  {NAV.map((n) => (
                    <Link key={n.to} to={n.to} onClick={() => setMenuOpen(false)}
                      className="flex h-12 items-center rounded-xl px-3 text-base font-semibold text-foreground outline-none hover:bg-primary-soft focus-visible:ring-3 focus-visible:ring-ring/40"
                      activeProps={{ className: "bg-primary-soft !text-primary-strong" }}>
                      {n.label}
                    </Link>
                  ))}
                  <Button asChild className="mt-4"><Link to="/auth" search={{ mode: "signup" }} onClick={() => setMenuOpen(false)}>Start free trial</Link></Button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      )}
      <main id="main" className="flex-1">{children}</main>
      <footer className={cn("border-t", home ? "mer-ink border-white/10 text-white" : "border-border/70 bg-card")}>
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] sm:px-6">
          <div>
            <div className="flex items-center gap-2.5">
              <BrandLogo className="h-8 w-auto" onDark={home} />
            </div>
            <p className={cn("mt-3 max-w-sm text-sm", home ? "text-white/75" : "text-muted-foreground")}>Zikora brings the daily work of running a hotel into one connected system, with a clearer record of rooms, service and money.</p>
          </div>
          <FooterLinks dark={home} title="Product" links={[{ to: "/features", label: "Features" }, { to: "/security", label: "Security" }, { to: "/faq", label: "FAQ" }]} />
          <FooterLinks dark={home} title="Company" links={[{ to: "/about", label: "About" }, { to: "/contact", label: "Contact" }]} />
          {!signedIn && (
            <div>
              <h2 className="text-sm font-bold">Get started</h2>
              <ul className="mt-3 space-y-2">
                <li><Link to="/auth" search={{ mode: "signup" }} className={cn("text-sm outline-none focus-visible:underline", home ? "text-white/75 hover:text-white" : "text-muted-foreground hover:text-foreground")}>Start free trial</Link></li>
                <li><Link to="/auth" className={cn("text-sm outline-none focus-visible:underline", home ? "text-white/75 hover:text-white" : "text-muted-foreground hover:text-foreground")}>Sign in</Link></li>
              </ul>
            </div>
          )}
          <FooterLinks dark={home} title="Legal" links={[{ to: "/privacy", label: "Privacy notice" }, { to: "/terms", label: "Terms of use" }]} />
        </div>
        <div className={cn("border-t", home ? "border-white/10" : "border-border/70")}>
          <p className={cn("mx-auto max-w-6xl px-4 py-4 text-xs sm:px-6", home ? "text-white/70" : "text-muted-foreground")}>
            © {SITE_INFO["copyright year"]} Zikora. {SITE_INFO["legal entity and company details"]}
          </p>
        </div>
      </footer>
    </div>
  );
}

type FooterLink = { to: "/" | "/features" | "/security" | "/pricing" | "/faq" | "/about" | "/contact" | "/privacy" | "/terms"; label: string };
function FooterLinks({ title, links, dark }: { title: string; links: FooterLink[]; dark?: boolean }) {
  return (
    <div>
      <h2 className="text-sm font-bold">{title}</h2>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.to}><Link to={l.to} className={cn("text-sm outline-none focus-visible:underline", dark ? "text-white/75 hover:text-white" : "text-muted-foreground hover:text-foreground")}>{l.label}</Link></li>
        ))}
      </ul>
    </div>
  );
}

/** Page width and spacing for public sections. */
export function Section({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return <section id={id} className={cn("mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20", className)}>{children}</section>;
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

const HOME_NAV: { href: string; label: string; to?: "/features" }[] = [
  { href: "/features", label: "Features", to: "/features" },
  { href: "#preview", label: "Product" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

/** Home page header: a full-width dark bar; the content inside lines up with the page below it. Same links and sign-in rules as the other pages. */
function HomeHeader({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const link = "rounded-full px-3 py-1.5 text-sm font-semibold text-white/80 outline-none hover:text-white focus-visible:ring-3 focus-visible:ring-white/40";
  return (
    <header className="mer-ink sticky top-0 z-20 border-b border-white/10 shadow-raised" data-home-header>
      <div className="mer-drop mx-auto flex h-16 max-w-6xl items-center gap-x-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-white/40" aria-label="Zikora home">
          <BrandLogo onDark className="h-8 w-auto" />
        </Link>
        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 lg:flex">
          {HOME_NAV.map((n) => n.to
            ? <Link key={n.label} to={n.to} className={link}>{n.label}</Link>
            : <a key={n.label} href={n.href} className={link}>{n.label}</a>)}
        </nav>
        <div className="ml-auto flex items-center gap-2 lg:ml-3">
          {signedIn
            ? <Button asChild size="sm" variant="secondary"><Link to="/dashboard">Open the app</Link></Button>
            : <>
                <Link to="/auth" className={cn(link, "hidden sm:inline-flex")}>Sign in</Link>
                <Button asChild size="sm" variant="secondary"><Link to="/auth" search={{ mode: "signup" }}>Start free trial</Link></Button>
              </>}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white lg:hidden" aria-label="Open menu"><Menu className="size-5" /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <nav aria-label="Menu" className="mt-8 flex flex-col gap-1">
                {NAV.map((n) => (
                  <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="flex h-12 items-center rounded-xl px-3 text-base font-semibold text-foreground outline-none hover:bg-primary-soft focus-visible:ring-3 focus-visible:ring-ring/40">{n.label}</Link>
                ))}
                <Link to="/auth" onClick={() => setOpen(false)} className="flex h-12 items-center rounded-xl px-3 text-base font-semibold text-foreground outline-none hover:bg-primary-soft sm:hidden">Sign in</Link>
                <Button asChild className="mt-4"><Link to="/auth" search={{ mode: "signup" }} onClick={() => setOpen(false)}>Start free trial</Link></Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

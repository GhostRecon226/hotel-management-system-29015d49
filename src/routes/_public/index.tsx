import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Wifi, Check } from "lucide-react";
import { Hero } from "@/components/public/hero";
import { Section } from "@/components/public/public-layout";
import { AllInOne, FactsStrip, NightShift, RoleScreens } from "@/components/public/home-sections";
import { Button } from "@/components/ui/button";
import { hasStoredSession } from "@/lib/session-hint";
import { ORGANIZATION_LD, pageHead } from "@/lib/seo";

const TITLE = "Hotel Management Software for Africa | Zikora";
const DESCRIPTION = "Take bookings, check guests in and out and keep every bill correct. Hotel software built in Africa, launching in Nigeria. Try it free for 30 days.";

const softwareLd = {
  "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Zikora",
  applicationCategory: "BusinessApplication", operatingSystem: "Web browser", description: DESCRIPTION,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "30-day free trial" },
};

export const Route = createFileRoute("/_public/")({
  head: () => pageHead({ title: TITLE, description: DESCRIPTION, jsonLd: [ORGANIZATION_LD, softwareLd] }),
  component: Home,
});

const PAINS = [
  "The bill at check-out does not match what the guest remembers.",
  "A discount was given and nobody can say who approved it.",
  "The front desk thinks a room is ready. Housekeeping has not touched it.",
  "You are away from the hotel and you cannot tell how the day went.",
];

const TRUST = [
  "Your data is stored on secure servers in the European Union (Ireland).",
  "Each hotel's data is kept separate from every other hotel's.",
  "Export bookings, transactions and guests to a spreadsheet at any time.",
  "Runs in your browser on a computer, tablet or phone. Nothing to install. It needs an internet connection.",
];

function Home() {
  const navigate = useNavigate();
  // Signed-in users go to the app, as before. Only "/" redirects; other public pages stay readable.
  useEffect(() => { if (hasStoredSession()) navigate({ to: "/dashboard", replace: true }); }, [navigate]);

  return (
    <>
      <Hero label="Hotel management software for Africa"
        lead="Know every payment" rest="that comes through your front desk."
        text="Zikora is hotel management software built in Africa, for independent hotels. Take bookings, check guests in and out, keep rooms ready and keep every bill correct, in your own currency. We are launching in Nigeria." />

      <FactsStrip />

      <AllInOne />

      <Section className="pt-0 sm:pt-0">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border/70 bg-card p-6 shadow-card sm:p-8">
          <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">Sound familiar?</h2>
          <ul className="mt-4 space-y-2.5 text-[15px] text-muted-foreground">
            {PAINS.map((p) => <li key={p} className="flex gap-2.5"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{p}</li>)}
          </ul>
          <p className="mt-5 font-semibold">Zikora is built to end these problems, one screen at a time.</p>
        </div>
      </Section>

      <NightShift />

      <RoleScreens />

      <Section className="pt-0 sm:pt-0">
        <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">Start in three steps</h2>
        <ol className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-3">
          {["Create your hotel account.", "Add your rooms, rates and staff.", "Take your first booking."].map((s, i) => (
            <li key={s} className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
              <span className="grid size-9 place-items-center rounded-full bg-primary-soft text-sm font-extrabold text-primary-strong" aria-hidden>{i + 1}</span>
              <p className="mt-3 font-semibold">{s}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section className="pt-0 sm:pt-0">
        <div className="flex flex-col gap-5 rounded-2xl border border-border/70 bg-card p-6 shadow-card sm:flex-row sm:items-start sm:p-8">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-info-soft text-info-strong" aria-hidden><Wifi className="size-6" /></span>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Built with your data in mind</h2>
            <ul className="mt-3 grid gap-2.5 text-[15px] text-muted-foreground sm:grid-cols-2">
              {TRUST.map((t) => <li key={t} className="flex gap-2.5"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success-strong" />{t}</li>)}
            </ul>
            <p className="mt-4 text-sm"><Link to="/security" className="font-semibold text-primary underline-offset-4 hover:underline">How we protect guest records and money</Link></p>
          </div>
        </div>
      </Section>

      <Section className="pt-0 sm:pt-0">
        <div className="relative overflow-hidden rounded-2xl bg-accent-fill px-6 py-12 text-center text-primary-foreground shadow-accent sm:px-12">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-white/10" />
          <h2 className="relative text-2xl font-extrabold tracking-tight sm:text-3xl">Try Zikora free for 30 days.</h2>
          <p className="relative mx-auto mt-2 max-w-xl text-[15px] text-on-primary-muted">No card needed. If you decide it is not for you, nothing is deleted.</p>
          <div className="relative mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary"><Link to="/auth">Start your free trial</Link></Button>
            <Button asChild size="lg" variant="secondary"><Link to="/pricing">See pricing</Link></Button>
          </div>
        </div>
      </Section>
    </>
  );
}

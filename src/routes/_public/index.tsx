import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Hero } from "@/components/public/hero";
import { CapabilityOverview, ClosingCta, ControlStrip, Handovers, ProofPillars, TeamHandover } from "@/components/public/home-sections";
import { hasStoredSession } from "@/lib/session-hint";
import { ORGANIZATION_LD, pageHead } from "@/lib/seo";

const TITLE = "Hotel Management Software for Modern Hotels | Zikora";
const DESCRIPTION = "Bring reservations, front desk, housekeeping, maintenance and hotel financial records into one connected hotel management system.";

const softwareLd = {
  "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Zikora",
  applicationCategory: "BusinessApplication", operatingSystem: "Web browser", description: DESCRIPTION,
};

export const Route = createFileRoute("/_public/")({
  head: () => pageHead({ title: TITLE, description: DESCRIPTION, path: "/", jsonLd: [ORGANIZATION_LD, softwareLd] }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  // Signed-in users go to the app, as before. Only "/" redirects; other public pages stay readable.
  useEffect(() => { if (hasStoredSession()) navigate({ to: "/dashboard", replace: true }); }, [navigate]);

  return (
    <>
      <Hero label="Hotel operations. Clearer control."
        lead="Know what’s happening in your hotel." rest="Keep control of the details."
        text="A room gets moved. A guest asks for a discount. Housekeeping needs to know what to clean. Accounts needs to know what was paid. Zikora connects these everyday workflows, so your team can work from the same record and managers can see the activity behind the day’s numbers."
        trust="Launching across different markets · Designed for independent hotel operations" />
      <Handovers />
      <ProofPillars />
      <TeamHandover />
      <CapabilityOverview />
      <ControlStrip />
      <ClosingCta title="See how Zikora fits the way your hotel works."
        text="Bring your current process and the questions your team deals with every day. We’ll walk through the relevant workflows, explain what is available now, and discuss whether pilot access is a fit." />
    </>
  );
}

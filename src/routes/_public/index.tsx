import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Hero } from "@/components/public/hero";
import { ClosingCta } from "@/components/public/home-sections";
import { Hub } from "@/components/public/home/hub";
import { Explore } from "@/components/public/home/explore";
import { Modules } from "@/components/public/home/modules";
import { useScrollReveal } from "@/components/public/home/use-scroll-reveal";
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
  useEffect(() => { if (hasStoredSession()) navigate({ to: "/home", replace: true }); }, [navigate]);
  useScrollReveal();

  return (
    <>
      <Hero />
      <Hub />
      <Modules />
      <Explore />
      <ClosingCta title="Try it on your own hotel."
        text="Start your Zikora journey. 60 days free, every feature, no card needed." />
    </>
  );
}

export const SITE_URL = "https://www.zikorahq.com";

/**
 * Search and share details for a public page. Titles stay under 60 characters and descriptions under 155.
 * `path` adds the canonical address and og:url. `jsonLd` adds structured data (Organization, SoftwareApplication, FAQPage).
 * No locale or country is set: the pages do not name one market.
 */
export function pageHead({ title, description, path, jsonLd }: { title: string; description: string; path?: string; jsonLd?: object[] }) {
  const url = path === undefined ? undefined : `${SITE_URL}${path}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Zikora" },
      ...(url ? [{ property: "og:url", content: url }] : []),
      { property: "og:image", content: `${SITE_URL}/brand/zikora-logo.png` },
      { name: "twitter:card", content: "summary" },
    ],
    links: url ? [{ rel: "canonical", href: url }] : [],
    scripts: (jsonLd ?? []).map((data) => ({ type: "application/ld+json", children: JSON.stringify(data) })),
  };
}

export const ORGANIZATION_LD = {
  "@context": "https://schema.org", "@type": "Organization", name: "Zikora", url: SITE_URL, logo: `${SITE_URL}/brand/zikora-icon.png`,
  description: "Hotel management software that connects reservations, front desk, housekeeping, maintenance and financial records.",
};

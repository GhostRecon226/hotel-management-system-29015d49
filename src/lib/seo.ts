/**
 * Search and share details for a public page. Titles stay under 60 characters and descriptions under 155.
 * `jsonLd` adds structured data (Organization, SoftwareApplication, FAQPage) for search engines.
 */
export function pageHead({ title, description, jsonLd }: { title: string; description: string; jsonLd?: object[] }) {
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "en_NG" },
      { name: "twitter:card", content: "summary" },
    ],
    scripts: (jsonLd ?? []).map((data) => ({ type: "application/ld+json", children: JSON.stringify(data) })),
  };
}

export const ORGANIZATION_LD = { "@context": "https://schema.org", "@type": "Organization", name: "Hotel Desk Ltd", description: "Hotel management software for independent hotels in Nigeria." };

export const SITE_URL = "https://www.zikorahq.com";

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
      { property: "og:site_name", content: "Zikora" },
      { property: "og:image", content: `${SITE_URL}/brand/zikora-logo.png` },
      { name: "twitter:card", content: "summary" },
    ],
    scripts: (jsonLd ?? []).map((data) => ({ type: "application/ld+json", children: JSON.stringify(data) })),
  };
}

export const ORGANIZATION_LD = { "@context": "https://schema.org", "@type": "Organization", name: "Zikora Ltd", url: SITE_URL, logo: `${SITE_URL}/brand/zikora-icon.png`, description: "Hotel management software for independent hotels in Africa." };

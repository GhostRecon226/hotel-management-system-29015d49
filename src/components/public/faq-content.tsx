/**
 * Public FAQ. Copy revamp v3 (Oct 2026). Every answer was checked against the status document of 10 Oct 2026.
 * Do not add a claim here without checking it in the app first. Features that are not built stay off the site.
 * Answers are plain text so the same words feed the FAQ structured data for search engines.
 * `more` adds one link after the answer.
 */
export type Faq = {
  id: string;
  group: string;
  q: string;
  a: string;
  more?: { to: "/contact" | "/security" | "/walkthrough"; label: string };
};

export const FAQS: Faq[] = [
  { id: "what", group: "About Zikora", q: "What is Zikora?",
    a: "Zikora is a hotel management system that connects reservations, front desk, guest records, folios, cashiering, housekeeping, maintenance, collections and reporting." },
  { id: "who", group: "About Zikora", q: "Who is Zikora for?",
    a: "Zikora is designed for hotel operators who want their teams and key operating records in one connected system. Contact us to discuss whether the current workflows suit your property.",
    more: { to: "/contact", label: "Contact us" } },

  { id: "payments", group: "Money and controls", q: "Can Zikora record payments?",
    a: "Yes. Zikora records payments made through the hotel's existing payment process and links them to the relevant financial records. Integrated online card or transfer collection inside Zikora is not currently available." },
  { id: "approvals", group: "Money and controls", q: "Can staff approve their own refunds or discounts?",
    a: "No. Configured high-risk actions, including discounts above limits, adjustments, reversals and refunds, require approval from another authorised person. A requester cannot approve their own request." },
  { id: "cashier", group: "Money and controls", q: "Can it help with cashier accountability?",
    a: "Cashiers can open a shift with a float, record payments, count and close the shift, and review what remains open." },
  { id: "tax", group: "Money and controls", q: "Does Zikora calculate VAT and service charge?",
    a: "Zikora includes configurable tax and service-charge settings with local defaults. An accountant should confirm the correct treatment for your hotel. Zikora does not claim tax-authority approval or tax compliance on your behalf." },

  { id: "housekeeping", group: "Daily operations", q: "Does it connect housekeeping to check-out?",
    a: "A cleaning task can open automatically at check-out or a room move. Staff can complete the task in a phone browser, and a different team member can inspect it." },
  { id: "offline", group: "Daily operations", q: "Does it work offline?",
    a: "No. Zikora requires an internet connection. A printable downtime pack is available for use during a disruption." },

  { id: "messages", group: "What is not available yet", q: "Can Zikora send guest messages by email or WhatsApp?",
    a: "Guest email, SMS and WhatsApp messaging integrations are not currently available." },
  { id: "channels", group: "What is not available yet", q: "Does it connect to online booking sites?",
    a: "A direct booking engine and channel-manager integrations are future roadmap items, not current features." },

  { id: "data", group: "Data and security", q: "Where is hotel data stored?",
    a: "The current database is hosted in Ireland. Each hotel's data is separated from other hotels' data. Hotels should review their own contractual and data-protection obligations with appropriate advice.",
    more: { to: "/security", label: "Read about security" } },
  { id: "certification", group: "Data and security", q: "Does Zikora have ISO or SOC certification?",
    a: "No. Zikora does not currently hold ISO or SOC security certifications." },

  { id: "cost", group: "Pricing and next steps", q: "How much does it cost?",
    a: "Zikora is subscription-based. Plans and pricing are still being finalised, so contact us for current pricing and to confirm what fits your property.",
    more: { to: "/contact", label: "Contact us" } },
  { id: "demo", group: "Pricing and next steps", q: "How do I see it in action?",
    a: "Request a walkthrough and tell us about your hotel. The team can focus on the workflows most relevant to your operation.",
    more: { to: "/walkthrough", label: "Request a walkthrough" } },
];

/** The questions shown on the pricing page. */
export const PRICING_FAQ_IDS = ["cost", "payments", "tax", "data", "demo"];

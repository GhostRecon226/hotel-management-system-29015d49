import { ToConfirm } from "@/components/public/to-confirm";

/**
 * Public FAQ. Every answer was checked against what the app does (2 Oct 2026, reviewed 6 Oct 2026).
 * Do not add a claim here without checking it in the app first. Features that are not built stay off the site.
 * Answers are plain text so the same words feed the FAQ structured data for search engines.
 * `more` adds one link after the answer.
 */
export type Faq = {
  id: string;
  group: string;
  q: string;
  a: string;
  more?: { to: "/contact" | "/security" | "/privacy"; label: string };
};

export const FAQS: Faq[] = [
  { id: "what", group: "Getting started", q: "What is Hotel Desk?",
    a: "Hotel Desk is hotel management software that runs in your web browser. It handles bookings, check-in and check-out, rooms and housekeeping, maintenance, guest bills, invoices and reports. It is built for hotels in Nigeria and works in naira." },
  { id: "fit", group: "Getting started", q: "Is Hotel Desk made for hotels like mine?",
    a: "It is built for independent hotels in Nigeria, where the front desk takes cash, transfers and POS payments and one small team does many jobs. If you run guest rooms and a front desk, it fits." },
  { id: "cost", group: "Getting started", q: "How much does it cost?",
    a: "You start with a free trial. After that, the price depends on the size of your hotel. Talk to us and we will give you a price for your hotel.",
    more: { to: "/contact", label: "Talk to us" } },
  { id: "card", group: "Getting started", q: "Do I need a card to start the free trial?",
    a: "No. Create your account and your hotel, and your 30 days start. We never ask for card details." },
  { id: "trial-end", group: "Getting started", q: "What happens when my free trial ends?",
    a: "Your hotel becomes read-only until your plan starts. Your team can still record payments, settle bills and check guests out, but cannot add new bookings or charges. Nothing is deleted." },
  { id: "start-plan", group: "Getting started", q: "How do I start a paid plan, or cancel?",
    a: "Contact us. We agree the price, then switch your plan on. To cancel, contact us the same way.",
    more: { to: "/contact", label: "Contact us" } },

  { id: "tax", group: "Money and tax", q: "Does it work out VAT and service charge?",
    a: "Yes. Every charge shows the price, the service charge, VAT and any state levy. Each hotel sets its own rates, so set them with your accountant's advice." },
  { id: "payments", group: "Money and tax", q: "Does it take card payments?",
    a: "No. It records payments you take outside the system, such as cash, POS, bank transfer or card, and keeps every bill correct. It does not charge cards or move money." },
  { id: "duplicates", group: "Money and tax", q: "Can it stop us recording the same payment twice?",
    a: "Yes. A retry never posts twice. If a payment looks like one already recorded, the system shows the earlier payment and asks the cashier to confirm it is a second payment, with a reason." },
  { id: "invoices", group: "Money and tax", q: "Can I print invoices?",
    a: "Yes. Print interim bills during a stay and final invoices at check-out, with each tax shown. Issued invoices never change." },
  { id: "currency", group: "Money and tax", q: "Can I record payments in dollars or another currency?",
    a: "Yes. Record a payment in another currency at the exchange rate you set. Bills themselves are in naira." },

  { id: "devices", group: "Daily use", q: "Can I use it on a phone or tablet?",
    a: "Yes. It works in the browser on a computer, tablet or phone. There is nothing to install." },
  { id: "offline", group: "Daily use", q: "Does it work without internet?",
    a: "No, it needs an internet connection." },
  { id: "housekeeping", group: "Daily use", q: "Does it handle housekeeping and maintenance?",
    a: "Yes. Housekeeping sees which rooms are clean, dirty or out of order, gets cleaning tasks when guests leave or move rooms, and records inspections. Staff report repairs, and rooms can be taken out of sale while they are fixed." },
  { id: "night-audit", group: "Daily use", q: "Does it close the day for me?",
    a: "Yes. Every night it closes the day by itself. It posts room charges, marks guests who did not arrive and saves the day's figures." },
  { id: "reports", group: "Daily use", q: "What reports do I get?",
    a: "Occupancy, average daily rate, revenue per available room, revenue by type of charge, outstanding balances, payments, cancellations and length of stay. You can export bookings, transactions and guests to a spreadsheet." },

  { id: "roles", group: "Staff and control", q: "Can I give staff different access?",
    a: "Yes. Use ready-made roles such as front desk, reservations, housekeeping, maintenance, cashier and accountant, or make your own." },
  { id: "approvals", group: "Staff and control", q: "Can staff give discounts or refunds on their own?",
    a: "Only within the limit you set. Discounts above a limit, adjustments, reversals and refunds need a second person to approve, and nobody can approve their own request." },

  { id: "data", group: "Your data", q: "Where is my data kept, and is it safe?",
    a: "Your data is stored on secure servers in the European Union (Ireland). Each hotel's data is kept separate, and staff see only what their role allows.",
    more: { to: "/security", label: "Read about security" } },
  { id: "own-data", group: "Your data", q: "Who owns my data? Can I take it with me?",
    a: "You do. Export bookings, transactions and guests to a spreadsheet whenever you like. We do not sell your information.",
    more: { to: "/privacy", label: "Read the privacy notice" } },
  { id: "id-photos", group: "Your data", q: "Do you keep photos of guests' ID?",
    a: "Only if your hotel switches that on. Photos are stored privately, opened through short-lived links, and deleted automatically 12 months after the guest's last check-out." },
];

/** Help answer: its contact details come from src/lib/site-info.ts through <ToConfirm>. */
export function HelpAnswer() {
  return <>Email <ToConfirm what="contact email" /> or call <ToConfirm what="phone" />. Support hours: <ToConfirm what="support hours" />.</>;
}

/** The five questions shown on the pricing page. */
export const PRICING_FAQ_IDS = ["cost", "card", "trial-end", "devices", "data"];

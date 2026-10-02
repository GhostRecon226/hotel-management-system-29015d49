import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ToConfirm } from "@/components/public/to-confirm";

/**
 * Public FAQ. Every answer was checked against what the app does on 2 Oct 2026. "planned" answers describe
 * something not built or not switched on yet, and are shown with a "Planned" label. Do not add claims here
 * without checking them in the app first.
 */
export type Faq = { id: string; q: string; a: ReactNode; planned?: boolean };

const link = "font-semibold text-primary underline-offset-4 hover:underline";

export const FAQS: Faq[] = [
  { id: "what", q: "What is Hotel Desk?",
    a: <>A system for running a hotel in your web browser: bookings, check-in and check-out, rooms and housekeeping, maintenance, guest bills, invoices and reports. It is built for hotels in Nigeria and works in naira.</> },
  { id: "cost", q: "How much does it cost?",
    a: <>You start with a free trial. After that, pricing depends on the size of your hotel. <Link to="/contact" className={link}>Contact us</Link> for a price for your hotel.</> },
  { id: "card", q: "Do I need a card to start the free trial?",
    a: <>No. You create an account and your hotel, and the 30-day trial starts. We never ask for card details.</> },
  { id: "trial-end", q: "What happens when my free trial ends?",
    a: <>Your hotel becomes read-only until we start your plan. You can still record payments, settle bills and check guests out, but you cannot add new bookings or charges. Nothing is deleted.</> },
  { id: "start-plan", q: "How do I start a paid plan?",
    a: <><Link to="/contact" className={link}>Contact us</Link>. We agree the price for your hotel and switch your plan on.</> },
  { id: "cancel", q: "Can I cancel?",
    a: <>Yes. <Link to="/contact" className={link}>Contact us to cancel.</Link></> },
  { id: "devices", q: "Can I use it on a phone or tablet?",
    a: <>Yes. It works in the web browser on a computer, tablet or phone. There is nothing to install.</> },
  { id: "offline", q: "Does it work without internet?",
    a: <>No, it needs an internet connection.</> },
  { id: "data", q: "Where is my data kept, and is it safe?",
    a: <>Your data is stored on secure servers in the European Union (Ireland). Each hotel's data is kept separate, and staff only see what their role allows. Your data is yours: you can export bookings, transactions and guests to a spreadsheet at any time.</> },
  { id: "payments", q: "Does it take card payments?",
    a: <>No. It records payments you take outside the system, such as cash, POS, bank transfer or card, and keeps every bill correct. It does not charge cards.</> },
  { id: "tax", q: "Does it work out VAT and service charge?",
    a: <>Yes. Every charge shows the price, service charge, VAT and any state levy. Each hotel sets its own rates; set them to your accountant's advice.</> },
  { id: "roles", q: "Can I give staff different access?",
    a: <>Yes. There are ready-made roles such as front desk, reservations, housekeeping, maintenance, cashier and accountant, and you can make your own. Discounts above a limit, adjustments, reversals and refunds need a second person to approve.</> },
  { id: "housekeeping", q: "Does it handle housekeeping and maintenance?",
    a: <>Yes. Housekeeping sees which rooms are clean, dirty or out of order, gets cleaning tasks when guests leave or move rooms, and records inspections. Staff report repairs, and rooms can be taken out of sale while they are fixed.</> },
  { id: "reports", q: "What reports do I get?",
    a: <>Occupancy, average daily rate (ADR), revenue per available room (RevPAR), revenue by type of charge, outstanding balances, payments, cancellations and length of stay. You can export bookings, transactions and guests to a spreadsheet.</> },
  { id: "night-audit", q: "Does it close the day for me?",
    a: <>Yes. Every night it closes the day by itself: it posts room charges, marks guests who did not arrive, and saves the day's figures.</> },
  { id: "invoices", q: "Can I print invoices?",
    a: <>Yes. You can print interim and final invoices, with each tax shown.</> },
  { id: "emails", q: "Does it send booking confirmation emails?", planned: true,
    a: <>Planned. Confirmation emails are built and will be switched on when email sending is connected.</> },
  { id: "multi", q: "Can I manage more than one hotel?", planned: true,
    a: <>Planned. Today each account runs one hotel.</> },
  { id: "currency", q: "Can I use cedis or another currency?", planned: true,
    a: <>Planned. Today bills are in naira. You can already record payments in other currencies at the exchange rate you set.</> },
  { id: "help", q: "How do I get help?",
    a: <>Email <ToConfirm what="contact email" /> or call <ToConfirm what="phone" />. Support hours: <ToConfirm what="support hours" />.</> },
];

/** The five questions shown on the pricing page (Peter, 2 Oct 2026: Q2, Q3, Q4, Q7, Q9). */
export const PRICING_FAQ_IDS = ["cost", "card", "trial-end", "devices", "data"];

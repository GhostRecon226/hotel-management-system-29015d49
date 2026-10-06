/**
 * Stand-in text for the public pages. Generic on purpose: the product name, company, phone, email and legal wording
 * are not decided yet. Each key is the `what` of a <ToConfirm> marker. Change a value here and the page follows.
 * A production build refuses to run while any marker is in use (scripts/check-to-confirm.mjs), so none of this
 * can reach the live address by accident. Preview addresses build fine.
 */
export const SITE_INFO: Record<string, string> = {
  "company name": "Hotel Desk Ltd",
  "contact email": "hello@hoteldesk.example",
  "phone": "+234 800 000 0000",
  "WhatsApp": "+234 800 000 0000",
  "support hours": "Monday to Friday, 8am to 6pm (Lagos time)",
  "about text":
    "We started Hotel Desk after seeing how much time independent hotels lose to paper registers, spreadsheets and bills that do not add up. We built one simple system for the front desk, housekeeping and the accounts, in naira, that a small team can learn in a day. We work with a few pilot hotels first and build what they ask for.",
  "date of the final version": "6 October 2026 (draft)",
  "purpose and legal basis, for example a guest register rule, after legal review":
    "to keep the guest register the law requires and to confirm who is staying (draft wording)",
  "keep period, after legal review": "The hotel can ask for it to be deleted earlier (draft wording)",
  "the safeguard for keeping guest ID photos outside Nigeria, after legal review":
    "The files are private, encrypted in storage, and only people with permission at the hotel can open them (draft wording)",
  "retention period, after legal review": "90 days, then it is deleted (draft wording)",
  "who answers data requests": "our privacy contact",
  "payment terms": "Pilot hotels are invoiced monthly in naira, due within 14 days (draft wording)",
  "liability and governing law, after legal review":
    "Draft wording: our liability is limited to the fees you paid in the previous 12 months. Nigerian law governs these terms.",
};

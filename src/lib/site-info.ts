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
    "We started Hotel Desk after seeing how much time independent hotels lose to paper registers, spreadsheets and bills that do not add up. We wanted one simple system for the front desk, housekeeping and the accounts, in naira, that a small team can pick up quickly. We are working with a small number of pilot hotels first, and we build what they ask for.",
  "date of the final version": "6 October 2026 (draft)",
  "purpose and legal basis, for example a guest register rule, after legal review":
    "to keep the guest register the law requires and to confirm who is staying (draft wording)",
  "keep period, after legal review": "The hotel can ask for it to be deleted earlier (draft wording)",
  "the safeguard for keeping guest ID photos outside Nigeria, after legal review":
    "The files are private, encrypted in storage, and only people with permission at the hotel can open them (draft wording)",
  "retention period, after legal review": "we keep its information for 90 days, then delete it (draft wording)",
  "who answers data requests": "our privacy contact",
  "company role and registration, after legal review": "We run the software. Each hotel is responsible for the guest information it records.",
  "acceptable use wording, after legal review": "Please do not use Hotel Desk to break the law, to try to reach another hotel's data, to interfere with the service, or to share your sign-in with people outside your hotel.",
  "availability wording, after legal review": "We work to keep Hotel Desk available and your data safe. We may pause the service briefly for maintenance. We cannot promise it will never be interrupted.",
  "rights and response times, after legal review": "You can ask what information we hold about you, ask us to correct it, or ask us to remove it.",
  "liability limit and exclusions, after legal review": "Nothing in these terms limits liability that the law does not allow us to limit. Otherwise, our liability to you is limited to the fees you paid in the previous 12 months.",
  "governing law and where disputes are heard, after legal review": "These terms are governed by the laws of the Federal Republic of Nigeria.",
  "payment terms": "Pilot hotels are invoiced monthly in naira, due within 14 days",
};

# Brief for the accountant: tax and service charge in Hotel Desk

From Peter, 2 Oct 2026. Hotel Desk is the system our hotels will use to bill guests in Nigeria. Before the first real hotel uses it, we need you to confirm or correct how it charges tax and service charge. Every figure below is what the system does today; a test in the system checks each example, so this page stays accurate.

## What every new hotel starts with

| Item | Rate | Charged on | Status |
|---|---|---|---|
| Service charge | 10% | the price before tax | Placeholder, not yet confirmed |
| VAT | 7.5% | the price **plus** the service charge | Placeholder, not yet confirmed |
| State levy (for example consumption tax) | 0% | the price before tax | Placeholder; set per state |

- All three apply to every charge: rooms, restaurant, minibar, laundry.
- **Cancellation and no-show fees carry no tax or service charge** for now, until you advise.
- A hotel can change the rates, switch one off, add another, and choose whether it is charged on the price alone or on the price plus the taxes before it.
- Prices are normally entered without tax, and the system adds tax on top. Staff can also enter a price that already includes tax; the system then works backwards to the price before tax.

## Worked examples

1. **A ₦10,000 dinner.** Service charge ₦1,000. VAT ₦825 (7.5% of ₦11,000). Levy ₦0. **The guest pays ₦11,825.**
2. **The same dinner with a 10% discount (₦1,182.50).** Today a discount comes off the price and off each tax in the same proportion: the price goes down by ₦1,000, the service charge by ₦100 and VAT by ₦82.50. **The guest pays ₦10,642.50**, and the tax collected falls with the discount.
3. **A price that already includes tax.** ₦11,825 entered "including tax" is recorded as ₦10,000 plus the same ₦1,000 and ₦825.
4. **Rounding.** Each tax is rounded to the kobo. When the parts do not add up to the total tax exactly, the difference (at most a kobo or two) goes on the last tax that has a rate, which is VAT today. Example: ₦7,777.77 gives service charge ₦777.78 and VAT ₦641.66.
5. **A method seen on a real hotel bill.** One Nigerian hotel charges service charge 10%, VAT 7.5% and a state tax of 5%, each on the room price alone, with no tax on another tax. Food and drink carry no tax. A room at ₦45,000 gives service charge ₦4,500, VAT ₦3,375 and state tax ₦2,250, so the room comes to ₦55,125. With ₦12,001 of bar charges the bill is **₦67,126**. Hotel Desk can do this with setup alone (each rate set to apply on the price alone, bar set as not taxable). The default method in examples 1 to 4 differs: it charges VAT on the price plus service charge. Question 1 asks which is right.

## Other things you should know

- **Same-day stays.** A guest who arrives and leaves on the same day is charged one night at the room rate, with tax as for any room night. A manager can waive it with a reason.
- **Corrections.** Posted charges are never edited or deleted. A mistake is corrected by a reversal or an adjustment, approved by a second person, and both rows stay on the record.
- **Currency.** Charges are in naira. Guests may pay in another currency at the rate the hotel sets for that day.
- **Invoices.** Final invoices and interim invoices have separate number series (INV and INT). Each invoice lists the price, each tax and the total.

## Questions we need you to answer

1. **Rates.** Are 10% service charge and 7.5% VAT right for a hotel in Lagos? Which state levy or consumption tax applies, at what rate, and is it charged on the price alone or on the price plus service charge?
2. **Order.** Is VAT charged on the price plus the service charge (as now), or on the price alone?
3. **Service charge.** Is the service charge treated as part of the hotel's revenue for VAT, or is it handled differently (for example, passed to staff)?
4. **Discounts.** Should a discount lower the tax as it does now (example 2), or should tax stay on the full price?
5. **Fees.** Should cancellation fees, no-show fees and the same-day stay charge carry VAT, service charge or levy?
6. **Rooms versus food and drink.** Do rooms and food and drink carry the same taxes and rates, or does any item need a different rate or none?
7. **Rounding.** Is rounding each tax to the kobo, with any remainder on VAT, acceptable to the tax office?
8. **Invoices and records.** What must appear on a guest invoice and a receipt (for example the hotel's tax identification number), and how long must the records be kept?
9. **Filing.** Which reports would you need from the system each month to file VAT and levy returns?

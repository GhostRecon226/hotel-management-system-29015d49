// Decision A16 (12 Oct 2026). These are the prices in the plans table (migration 20261020130000).
// The home page and the Pricing page both show this list. If a price changes, change the migration
// (or set it in the platform console) and this list together. The amount a hotel pays always comes from the database.
export const PLANS = [
  { name: "Starter", price: "₦30,000", year: "₦300,000", limits: ["Up to 20 rooms", "1 property", "Up to 10 staff users"] },
  { name: "Standard", price: "₦45,000", year: "₦450,000", limits: ["Up to 60 rooms", "1 property", "Up to 25 staff users"] },
  { name: "Pro", price: "₦80,000", year: "₦800,000", limits: ["Up to 150 rooms", "Up to 3 properties", "Up to 60 staff users"] },
] as const;

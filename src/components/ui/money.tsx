import { cn } from "@/lib/utils";

const SYMBOL: Record<string, string> = { NGN: "₦", GHS: "GH₵", KES: "KSh", ZAR: "R", USD: "$", GBP: "£", EUR: "€" };

// Currencies without minor units. Same list as app.currency_decimals in the database.
const ZERO_DECIMALS = new Set(["XOF", "XAF", "RWF", "UGX", "BIF", "GNF", "KMF", "DJF", "JPY"]);

/** Decimal places for a currency (naira 2, CFA franc 0). */
export function currencyDecimals(currency = "NGN") {
  return ZERO_DECIMALS.has(currency.toUpperCase()) ? 0 : 2;
}

/** Format an amount with its currency symbol and decimals. Naira uses ₦. Formatting only: never used to add up. */
export function formatAmount(amount: number | string | null | undefined, currency = "NGN") {
  const n = Number(amount ?? 0);
  const dp = currencyDecimals(currency);
  const body = new Intl.NumberFormat("en-NG", { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(Math.abs(n));
  const sym = SYMBOL[currency] ?? `${currency} `;
  return `${n < 0 ? "−" : ""}${sym}${body}`;
}

/** Amount for tables and totals: right-aligned, tabular figures. Negative amounts show in red. */
export function Money({ amount, currency = "NGN", className }: { amount: number | string | null | undefined; currency?: string; className?: string }) {
  const n = Number(amount ?? 0);
  return (
    <span className={cn("block whitespace-nowrap text-right tabular", n < 0 && "text-destructive", className)}>
      {formatAmount(amount, currency)}
    </span>
  );
}

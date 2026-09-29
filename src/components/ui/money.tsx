import { cn } from "@/lib/utils";

const SYMBOL: Record<string, string> = { NGN: "₦", GHS: "GH₵", KES: "KSh", ZAR: "R", USD: "$", GBP: "£", EUR: "€" };

/** Format an amount with its currency symbol. Naira uses ₦. */
export function formatAmount(amount: number | string | null | undefined, currency = "NGN") {
  const n = Number(amount ?? 0);
  const body = new Intl.NumberFormat("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
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

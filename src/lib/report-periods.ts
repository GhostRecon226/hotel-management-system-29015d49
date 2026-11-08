import { addDays } from "@/lib/reports";

export type PeriodKey = "yesterday" | "7" | "30" | "month";
export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "yesterday", label: "Yesterday" },
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "month", label: "This month" },
];

/** Date range for a one-tap period, from the hotel's business date. Last days end yesterday (the last closed date); this month runs to today. */
export function periodRange(key: PeriodKey, businessDate: string): { from: string; to: string } {
  const yesterday = addDays(businessDate, -1);
  if (key === "yesterday") return { from: yesterday, to: yesterday };
  if (key === "7") return { from: addDays(yesterday, -6), to: yesterday };
  if (key === "30") return { from: addDays(yesterday, -29), to: yesterday };
  return { from: `${businessDate.slice(0, 8)}01`, to: businessDate };
}

/** The period button that matches the dates now showing, or null when the dates were typed by hand. */
export function matchingPeriod(range: { from: string; to: string }, businessDate: string): PeriodKey | null {
  for (const p of PERIODS) {
    const r = periodRange(p.key, businessDate);
    if (r.from === range.from && r.to === range.to) return p.key;
  }
  return null;
}

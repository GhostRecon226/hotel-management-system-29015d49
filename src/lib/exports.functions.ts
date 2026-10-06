import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ExportKind = "reservations" | "transactions" | "guests";

// Column order for the spreadsheet. The database returns each row as JSON, whose keys come back in no
// useful order; these go first, in this order, and anything else follows.
const COLUMN_ORDER = [
  "number", "reservation", "folio", "business_date", "posted_at", "guest", "first_name", "last_name", "status",
  "arrival_date", "departure_date", "nights", "room_type", "rate_plan", "adults", "children", "source", "company_name",
  "kind", "charge_code", "payment_method", "description", "reference", "currency", "amount", "fx_rate", "base_amount",
  "tax", "total_amount", "deposit_required", "phone", "email", "nationality", "created_at",
];

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const keys = Object.keys(rows[0]!);
  const rank = (k: string) => { const i = COLUMN_ORDER.indexOf(k); return i === -1 ? COLUMN_ORDER.length : i; };
  const header = [...keys].sort((x, y) => rank(x) - rank(y));
  const esc = (v: unknown) => {
    if (v == null) return "";
    let s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/^[=+\-@]/.test(s) && isNaN(Number(s))) s = `'${s}`; // stop spreadsheet formulas
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header.join(","), ...rows.map((r) => header.map((h) => esc(r[h])).join(","))].join("\n");
}

/** CSV export. Permission check and audit entry happen in export_data(). */
export const exportCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { kind: ExportKind; propertyId: string; from: string; to: string }) => {
    if (!["reservations", "transactions", "guests"].includes(input?.kind)) throw new Error("Choose what to export.");
    const d = /^\d{4}-\d{2}-\d{2}$/;
    if (!d.test(input.from) || !d.test(input.to)) throw new Error("Choose a valid date range.");
    if (!input.propertyId) throw new Error("Choose a property.");
    return { kind: input.kind, propertyId: String(input.propertyId), from: input.from, to: input.to };
  })
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("export_data", {
      p_kind: data.kind, p_property_id: data.propertyId, p_from: data.from, p_to: data.to,
    });
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Record<string, unknown>[];
    return { csv: toCsv(list), count: list.length, filename: `${data.kind}_${data.from}_${data.to}.csv` };
  });

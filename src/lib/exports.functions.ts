import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ExportKind = "reservations" | "transactions" | "guests";

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const header = Object.keys(rows[0]!);
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
  .inputValidator((input: { kind: ExportKind; propertyId: string; from: string; to: string }) => {
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

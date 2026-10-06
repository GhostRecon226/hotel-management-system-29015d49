import { Link } from "@tanstack/react-router";
import { useAccess } from "@/lib/access";
import { useFolioList, type FolioSummary } from "@/lib/folios";
import { formatDay } from "@/lib/reservations";
import { Badge } from "@/components/ui/badge";
import { formatAmount } from "@/components/ui/money";
import { cn } from "@/lib/utils";

/** Balance chip from the database's own figures (amount_due, credit); always with a text label. */
export function FolioBalanceChip({ f }: { f: Pick<FolioSummary, "amount_due" | "credit" | "currency"> }) {
  if (Number(f.amount_due) > 0) return <Badge variant="warning">Due {formatAmount(f.amount_due, f.currency)}</Badge>;
  if (Number(f.credit) > 0) return <Badge variant="info">Credit {formatAmount(f.credit, f.currency)}</Badge>;
  return <Badge variant="success">Settled</Badge>;
}

/** Open folios beside a folio's detail on wide screens (list and detail layout). */
export function FolioListPane({ activeId, className }: { activeId: string; className?: string }) {
  const { property } = useAccess();
  const { data = [], isLoading } = useFolioList(property?.id, "open");
  return (
    <aside aria-label="Open folios" className={cn("rounded-xl border border-border/70 bg-card shadow-card", className)}>
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3.5">
        <h2 className="text-[15px] font-bold">Open folios</h2>
        <Badge variant="brand">{data.length}</Badge>
      </div>
      <ul className="max-h-[calc(100vh-11rem)] space-y-1 overflow-y-auto p-2">
        {isLoading && <li className="px-3 py-2 text-sm text-muted-foreground">Loading…</li>}
        {!isLoading && data.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No open folios.</li>}
        {data.map((f) => (
          <li key={f.folio_id}>
            <Link to="/folios/$id" params={{ id: f.folio_id }}
              className={cn("block rounded-lg px-3 py-2.5 outline-none hover:bg-primary-tint focus-visible:ring-3 focus-visible:ring-ring/40",
                f.folio_id === activeId && "bg-primary-soft hover:bg-primary-soft")}
              aria-current={f.folio_id === activeId ? "page" : undefined}>
              <div className="flex items-center justify-between gap-2">
                <span className={cn("whitespace-nowrap text-sm font-semibold", f.folio_id === activeId ? "text-primary-strong" : "text-foreground")}>{f.number}</span>
                <FolioBalanceChip f={f} />
              </div>
              <div className="mt-0.5 truncate text-[13px] text-foreground">{f.guest_name ?? "Guest"}</div>
              <div className="truncate text-xs text-muted-foreground">
                {f.room_number ? `${f.room_number} · ` : ""}{formatDay(f.arrival_date, { day: "numeric", month: "short" })} – {formatDay(f.departure_date, { day: "numeric", month: "short" })}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useAccess } from "@/lib/access";
import { addDays, formatDay, useAvailability } from "@/lib/reservations";
import { PageHeader, FilterBar } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_app/reservations/availability")({ component: AvailabilityGrid });

const DAYS = 14;

function AvailabilityGrid() {
  const { property } = useAccess();
  const [start, setStart] = useState(property?.business_date ?? "");
  const end = start ? addDays(start, DAYS) : "";
  const { data, isLoading, error } = useAvailability(property?.id, start, end);

  const { dates, rows } = useMemo(() => {
    const dates = Array.from({ length: DAYS }, (_, i) => addDays(start, i));
    const map = new Map<string, { code: string; name: string; cells: Record<string, { available: number; sellable: number }> }>();
    for (const c of data ?? []) {
      const row = map.get(c.room_type_id) ?? { code: c.room_type_code, name: c.room_type_name, cells: {} };
      row.cells[c.stay_date] = { available: c.available, sellable: c.sellable };
      map.set(c.room_type_id, row);
    }
    return { dates, rows: [...map.entries()] };
  }, [data, start]);

  return (
    <div>
      <Link to="/reservations" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Reservations
      </Link>
      <PageHeader title="Availability" description="Free rooms per room type per night. Out-of-order and inactive rooms are not counted." />
      <FilterBar>
        <Button variant="outline" size="icon" aria-label="Previous two weeks" onClick={() => setStart(addDays(start, -DAYS))}><ChevronLeft /></Button>
        <Input type="date" className="w-44" aria-label="Start date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
        <Button variant="outline" size="icon" aria-label="Next two weeks" onClick={() => setStart(addDays(start, DAYS))}><ChevronRight /></Button>
        {property && start !== property.business_date && <Button variant="ghost" onClick={() => setStart(property.business_date)}>Today</Button>}
      </FilterBar>

      {isLoading ? <LoadingState label="Loading availability…" />
        : error ? <EmptyState title="Could not load availability" />
        : rows.length === 0 ? <EmptyState title="No room types yet" description="Add room types and rooms in Setup first." />
        : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-[15px]">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="sticky left-0 z-10 min-w-40 bg-muted px-3 py-2 text-left font-medium">Room type</th>
                  {dates.map((d) => (
                    <th key={d} className="min-w-14 px-2 py-2 text-center font-medium">
                      <span className="block text-xs text-muted-foreground">{formatDay(d, { weekday: "short" })}</span>
                      {formatDay(d, { day: "numeric", month: "short" })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([id, r]) => (
                  <tr key={id} className="border-t">
                    <td className="sticky left-0 z-10 bg-card px-3 py-2"><span className="font-medium">{r.code}</span> <span className="text-sm text-muted-foreground">{r.name}</span></td>
                    {dates.map((d) => {
                      const c = r.cells[d];
                      const n = c?.available ?? 0;
                      return (
                        <td key={d} title={c ? `${n} of ${c.sellable} free` : undefined}
                          className={cn("px-2 py-2 text-center tabular font-medium",
                            n <= 0 ? "bg-danger-soft text-danger-strong" : n <= 2 ? "bg-warning-soft text-warning-strong" : "")}>
                          {n}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      <p className="mt-3 text-sm text-muted-foreground">Red means no rooms left. Amber means two or fewer.</p>
    </div>
  );
}

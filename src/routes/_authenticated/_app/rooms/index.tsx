import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAccess } from "@/lib/access";
import { BLOCK_TYPES, ConditionBadge, CONDITIONS, useRoomBoard, type BoardRoom } from "@/lib/rooms";
import { PageHeader, FilterBar } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { BedDouble } from "lucide-react";
import { AvailabilityBar, FilledStat } from "@/components/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const EDGE: Record<string, string> = { success: "border-l-success", warning: "border-l-warning", danger: "border-l-destructive" };

export const Route = createFileRoute("/_authenticated/_app/rooms/")({ component: RoomBoard });

function Tile({ r }: { r: BoardRoom }) {
  return (
    <Link to="/rooms/$id" params={{ id: r.id }}
      className={cn("flex min-h-28 flex-col gap-2 rounded-xl border border-l-4 border-border/70 bg-card p-3.5 shadow-card outline-none transition-shadow hover:shadow-raised focus-visible:ring-3 focus-visible:ring-ring/40",
        EDGE[CONDITIONS[r.condition]?.tone ?? "warning"], !r.is_sellable && "bg-danger-soft/40")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xl font-bold tabular">{r.room_number}</span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">{r.room_type_code}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        <ConditionBadge condition={r.condition} />
        {r.is_occupied ? <Badge variant="info" dot>Occupied</Badge> : <Badge variant="neutral">Vacant</Badge>}
        {r.block_type ? <Badge variant="danger">{BLOCK_TYPES[r.block_type]}</Badge>
          : !r.is_sellable ? <Badge variant="danger">Not sellable</Badge> : null}
        {r.pending_blocks > 0 && <Badge variant="warning">Block pending</Badge>}
      </div>
      {r.current_guest_name && <span className="truncate text-sm text-muted-foreground">{r.current_guest_name}</span>}
    </Link>
  );
}

function RoomBoard() {
  const { property } = useAccess();
  const { data = [], isLoading, error } = useRoomBoard(property?.id);
  const [condition, setCondition] = useState("all");
  const [type, setType] = useState("all");

  const types = useMemo(() => [...new Map(data.map((r) => [r.room_type_id, r.room_type_code])).entries()], [data]);
  const floors = useMemo(() => {
    const shown = data.filter((r) => r.is_active
      && (condition === "all" || r.condition === condition)
      && (type === "all" || r.room_type_id === type));
    const map = new Map<string, BoardRoom[]>();
    for (const r of shown) {
      const k = r.floor?.trim() || "No floor";
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  }, [data, condition, type]);

  const active = data.filter((r) => r.is_active);
  const counts = {
    occupied: active.filter((r) => r.is_occupied).length,
    sellable: active.filter((r) => r.is_sellable).length,
    dirty: active.filter((r) => r.condition === "dirty").length,
  };
  const vacant = active.filter((r) => !r.is_occupied);
  const ready = vacant.filter((r) => r.is_sellable && (r.condition === "clean" || r.condition === "inspected")).length;

  return (
    <div>
      <PageHeader title="Rooms" description={`${active.length} rooms · ${counts.occupied} occupied · ${counts.sellable} sellable · ${counts.dirty} dirty`} />
      {!isLoading && active.length > 0 && (
        <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
          <FilledStat icon={BedDouble} label="Ready to sell tonight" value={ready} sub="Vacant, clean and sellable" />
          <Card>
            <CardHeader className="pb-4"><CardTitle>Rooms right now</CardTitle></CardHeader>
            <CardContent>
              <AvailabilityBar parts={[
                { label: "Occupied", count: counts.occupied, tone: "info" },
                { label: "Vacant clean", count: vacant.filter((r) => r.is_sellable && r.condition !== "dirty" && r.condition !== "out_of_order").length, tone: "success" },
                { label: "Vacant dirty", count: vacant.filter((r) => r.is_sellable && r.condition === "dirty").length, tone: "warning" },
                { label: "Not sellable", count: vacant.filter((r) => !r.is_sellable || r.condition === "out_of_order").length, tone: "danger" },
              ]} />
            </CardContent>
          </Card>
        </div>
      )}
      <FilterBar>
        <Select value={condition} onValueChange={setCondition}>
          <SelectTrigger className="w-48" aria-label="Condition"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All conditions</SelectItem>
            {Object.entries(CONDITIONS).map(([k, c]) => <SelectItem key={k} value={k}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-48" aria-label="Room type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All room types</SelectItem>
            {types.map(([id, code]) => <SelectItem key={id} value={id}>{code}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterBar>

      {isLoading ? <LoadingState label="Loading rooms…" />
        : error ? <EmptyState title="Could not load rooms" />
        : floors.length === 0 ? <EmptyState title={active.length ? "No rooms match these filters" : "No rooms yet"} description={active.length ? undefined : "Add rooms in Setup first."} />
        : floors.map(([floor, rooms]) => (
          <section key={floor} className="mb-6">
            <h2 className="mb-2.5 text-base font-bold">{floor === "No floor" ? floor : `Floor ${floor}`}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {rooms.map((r) => <Tile key={r.id} r={r} />)}
            </div>
          </section>
        ))}
    </div>
  );
}

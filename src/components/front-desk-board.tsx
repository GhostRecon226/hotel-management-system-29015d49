import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { formatAmount } from "@/components/ui/money";
import { Initials } from "@/components/dashboard-parts";
import { RoomName } from "@/components/room-name";
import { formatDay, nightsLabel, ResStatusBadge } from "@/lib/reservations";
import { RoomStateBadge, type ArrivalRow, type InHouseRow } from "@/lib/front-desk";
import type { BoardRoom } from "@/lib/rooms";
import { cn } from "@/lib/utils";

/** Case-insensitive search over the words on a card (guest, booking number, room label, company). */
export function matchesSearch(q: string, ...fields: (string | null | undefined)[]) {
  const needle = q.trim().toLowerCase();
  return !needle || fields.some((f) => (f ?? "").toLowerCase().includes(needle));
}

const CARD = "rounded-xl border border-border/70 bg-card p-3.5 shadow-card sm:p-4";

/** One arrival. A row of an arrivals table, so the guest, room, flags and button read as one line to a screen reader. */
export function ArrivalCard({ a, action }: { a: ArrivalRow; action: ReactNode }) {
  return (
    <div role="row" className={cn(CARD, "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5")}>
      <div role="cell" className="flex min-w-0 items-center gap-3">
        <Initials name={a.guest_name} className="size-10" />
        <div className="min-w-0">
          <Link to="/reservations/$id" params={{ id: a.id }} className="block truncate font-semibold text-primary-strong hover:underline">{a.guest_name ?? "Guest"}</Link>
          <span className="block text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {a.number} · {nightsLabel(a.nights)} · {a.room_type_code}{a.company_name ? ` · ${a.company_name}` : ""}
          </span>
          <span className="block text-sm text-muted-foreground tabular">{formatDay(a.arrival_date)} to {formatDay(a.departure_date)}</span>
        </div>
      </div>
      <div role="cell" className="justify-self-end">{action}</div>
      <div role="cell" className="col-span-2 flex flex-wrap items-center gap-1.5">
        {a.room_number
          ? <span className="inline-flex items-center gap-2"><RoomName label={a.room_number} /><RoomStateBadge condition={a.room_condition} occupied={a.room_is_occupied} /></span>
          : <Badge variant="warning">No room yet</Badge>}
        <ResStatusBadge status={a.status} holdUntil={a.hold_until} />
        {a.is_late && <Badge variant="danger">Late arrival</Badge>}
        {a.arrival_ready && <Badge variant="success">Ready</Badge>}
        {a.deposit_due > 0 && <Badge variant="warning">Deposit due {formatAmount(a.deposit_due, a.currency)}</Badge>}
      </div>
    </div>
  );
}

/** One guest due out today. */
export function DepartureCard({ s, action }: { s: InHouseRow; action: ReactNode }) {
  return (
    <div role="listitem" className={cn(CARD, "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5")}>
      <div className="flex min-w-0 items-center gap-3">
        <Initials name={s.guest_name} className="size-10" />
        <div className="min-w-0">
          <Link to="/reservations/$id" params={{ id: s.reservation_id }} className="block truncate font-semibold text-primary-strong hover:underline">{s.guest_name ?? "Guest"}</Link>
          <span className="block text-sm text-muted-foreground [overflow-wrap:anywhere]">
            <RoomName label={s.room_number} className="text-foreground" /> · {s.number}{s.company_name ? ` · ${s.company_name}` : ""}
          </span>
          <span className="block text-sm text-muted-foreground tabular">{formatDay(s.arrival_date)} to {formatDay(s.departure_date)}</span>
        </div>
      </div>
      <div className="justify-self-end">{action}</div>
      <div className="col-span-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="warning">Due out</Badge>
        <Badge variant="neutral">Total {formatAmount(s.total_amount, s.currency)}</Badge>
      </div>
    </div>
  );
}

type Tile = { text: string; tone: string };
function tileFor(r: BoardRoom): Tile {
  if (r.is_occupied) return { text: "Occupied", tone: "border-info/30 bg-info-soft text-info-strong" };
  if (r.condition === "out_of_order" || r.block_id) return { text: r.block_id ? "Blocked" : "Out of order", tone: "border-destructive/30 bg-danger-soft text-danger-strong" };
  if (r.condition === "dirty") return { text: "Dirty", tone: "border-warning/30 bg-warning-soft text-warning-strong" };
  return { text: "Clean", tone: "border-success/30 bg-success-soft text-success-strong" };
}

/** Every room as a small tile: the label as typed and its state in words as well as colour. A tile opens the room. */
export function RoomTiles({ rooms, loading }: { rooms: BoardRoom[]; loading: boolean }) {
  if (loading) return <p className="text-sm text-muted-foreground">Loading rooms…</p>;
  if (rooms.length === 0) return <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No rooms match.</p>;
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
      {rooms.map((r) => {
        const t = tileFor(r);
        return (
          <li key={r.id}>
            <Link to="/rooms/$id" params={{ id: r.id }} aria-label={`Room ${r.room_number}, ${t.text}`}
              className={cn("flex min-h-14 flex-col items-center justify-center rounded-lg border px-1.5 py-2 text-center outline-none transition-shadow hover:shadow-raised focus-visible:ring-3 focus-visible:ring-ring/40", t.tone)}>
              <span className="max-w-full truncate text-base font-bold leading-tight tabular">{r.room_number}</span>
              <span className="text-xs font-medium leading-tight">{t.text}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

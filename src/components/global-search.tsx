import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BedDouble, CalendarDays, Search, User } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAccess } from "@/lib/access";
import { callRpc } from "@/lib/setup";
import { formatDay } from "@/lib/reservations";
import { RoomName } from "@/components/room-name";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Found = {
  guests: { id: string; name: string; phone: string | null; email: string | null }[];
  reservations: { id: string; number: string; guest_name: string; arrival_date: string; departure_date: string; status: string; room_number: string | null }[];
  rooms: { id: string; room_number: string; room_type: string }[];
};

/** Search box in the top bar: guests, bookings and rooms from any screen. Open it with the button or Ctrl+K (Cmd+K on a Mac). */
export function GlobalSearch() {
  const { property } = useAccess();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { const t = setTimeout(() => setQ(text.trim()), 250); return () => clearTimeout(t); }, [text]);
  useEffect(() => { if (!open) { setText(""); setQ(""); } }, [open]);

  const online = typeof navigator === "undefined" || navigator.onLine;
  const { data, isFetching } = useQuery({
    queryKey: ["search", property?.id, q],
    enabled: open && !!property && q.length >= 2 && online,
    queryFn: () => callRpc<Found>("search_everything", { p_property_id: property!.id, p_query: q }),
  });
  const go = (fn: () => void) => { setOpen(false); fn(); };
  const total = (data?.guests.length ?? 0) + (data?.reservations.length ?? 0) + (data?.rooms.length ?? 0);
  const first = data?.reservations[0] ?? null;

  return (
    <>
      <Button variant="outline" className="hidden h-10 w-56 justify-start gap-2 rounded-full bg-card px-4 font-normal text-muted-foreground lg:flex"
        onClick={() => setOpen(true)} aria-label="Search guests, bookings and rooms">
        <Search className="size-[18px]" /> Search
        <kbd className="ml-auto rounded border border-border px-1.5 text-xs">Ctrl K</kbd>
      </Button>
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Search guests, bookings and rooms">
        <Search className="size-5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[20%] max-h-[70vh] translate-y-0 overflow-y-auto sm:max-w-xl">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogDescription className="sr-only">Find a guest, a booking or a room.</DialogDescription>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-10" autoFocus placeholder="Guest name, phone, booking number or room" aria-label="Search" value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || !data) return;
                const g = data.guests[0]; const r = data.rooms[0];
                if (first) go(() => navigate({ to: "/reservations/$id", params: { id: first.id } }));
                else if (g) go(() => navigate({ to: "/guests/$id", params: { id: g.id } }));
                else if (r) go(() => navigate({ to: "/rooms/$id", params: { id: r.id } }));
              }} />
          </div>
          {!online && <p className="text-sm text-muted-foreground">Search needs a connection.</p>}
          {online && q.length < 2 && <p className="text-sm text-muted-foreground">Type at least 2 letters.</p>}
          {online && q.length >= 2 && !isFetching && data && total === 0 && <p className="text-sm text-muted-foreground">Nothing found for “{q}”.</p>}
          {data && data.reservations.length > 0 && (
            <Group title="Bookings">
              {data.reservations.map((r) => (
                <Row key={r.id} icon={<CalendarDays className="size-4" />} onClick={() => go(() => navigate({ to: "/reservations/$id", params: { id: r.id } }))}
                  main={`${r.number} · ${r.guest_name}`}
                  sub={`${formatDay(r.arrival_date)} to ${formatDay(r.departure_date)} · ${r.status.replace(/_/g, " ")}`} />
              ))}
            </Group>
          )}
          {data && data.guests.length > 0 && (
            <Group title="Guests">
              {data.guests.map((g) => (
                <Row key={g.id} icon={<User className="size-4" />} onClick={() => go(() => navigate({ to: "/guests/$id", params: { id: g.id } }))}
                  main={g.name} sub={[g.phone, g.email].filter(Boolean).join(" · ")} />
              ))}
            </Group>
          )}
          {data && data.rooms.length > 0 && (
            <Group title="Rooms">
              {data.rooms.map((r) => (
                <Row key={r.id} icon={<BedDouble className="size-4" />} onClick={() => go(() => navigate({ to: "/rooms/$id", params: { id: r.id } }))}
                  main={<RoomName label={r.room_number} />} sub={r.room_type} />
              ))}
            </Group>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <ul className="space-y-0.5">{children}</ul>
    </section>
  );
}
function Row({ icon, main, sub, onClick }: { icon: ReactNode; main: ReactNode; sub?: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left outline-none hover:bg-primary-tint focus-visible:ring-3 focus-visible:ring-ring/40">
        <span className="text-muted-foreground">{icon}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{main}</span>
          {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
        </span>
      </button>
    </li>
  );
}

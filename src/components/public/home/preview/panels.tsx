import { useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, BedDouble, Coins, Percent, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatTile } from "@/components/stats";
import { m, useCalm } from "@/components/public/home/motion-kit";
import { cn } from "@/lib/utils";

/*
 * The four home page previews: drawn from the real Zikora screens (Front desk, Room board, Folio, Reports).
 * One made-up "Sample Hotel" with 20 rooms. Nothing here calls the app or a database, and nothing is added up in code:
 * the figures are fixed text that agree with each other (15 of 20 rooms sold, 12,000 each, 180,000 in all, 9,000 per room).
 * Amounts have no currency symbol. Only actions the real screens have are shown.
 * This file loads separately, shortly before the previews scroll into view (PLT-023).
 */
export type PreviewKind = "front-desk" | "rooms" | "money" | "reports";

/* ---------- shared bits ---------- */

function Frame({ title, children }: { title: string; children: ReactNode }) {
  const calm = useCalm();
  return (
    <m.div className="rounded-xl border border-border/70 bg-card p-4 shadow-card sm:p-6"
      initial={calm ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold">{title}</h3>
          <p className="text-xs text-muted-foreground">Sample Hotel · 20 rooms</p>
        </div>
        <Badge variant="neutral">Sample Data</Badge>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </m.div>
  );
}

function Segment<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { v: T; label: string }[] }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}
          className={cn("min-h-9 cursor-pointer rounded-full border px-3.5 py-1 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11",
            value === o.v ? "border-primary/30 bg-primary-soft text-primary-strong" : "border-border/70 bg-card text-muted-foreground hover:text-foreground")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** What just happened, spoken politely to screen readers and shown in plain text. */
function Note({ text, hint, onReset }: { text: string; hint: string; onReset?: (() => void) | undefined }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <p role="status" aria-live="polite" className="min-h-5">{text || hint}</p>
      {text && onReset && <Button type="button" size="sm" variant="outline" onClick={onReset}>Reset sample</Button>}
    </div>
  );
}

const Room = ({ n, type }: { n: string; type: string }) => <span className="whitespace-nowrap font-semibold">{n} <span className="font-normal text-muted-foreground">({type})</span></span>;

/* ---------- Front desk ---------- */

const ARRIVALS = [
  { id: "A", guest: "Guest A", stay: "2 nights · Deluxe", room: "106", type: "Deluxe", clean: true, deposit: "0" },
  { id: "B", guest: "Guest B", stay: "1 night · Standard", room: "104", type: "Standard", clean: false, deposit: "10,000" },
  { id: "C", guest: "Guest C", stay: "3 nights · Suite", room: "203", type: "Suite", clean: true, deposit: "0" },
];
const IN_HOUSE = [
  { room: "102", type: "Standard", guest: "Guest D", out: "Today", due: true },
  { room: "105", type: "Deluxe", guest: "Guest F", out: "In 2 days", due: false },
  { room: "201", type: "Standard", guest: "Guest E", out: "Today", due: true },
  { room: "202", type: "Suite", guest: "Guest G", out: "In 3 days", due: false },
];

function FrontDesk() {
  const [view, setView] = useState<"arrivals" | "in-house" | "departures">("arrivals");
  const [done, setDone] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const waiting = ARRIVALS.filter((a) => !done.includes(a.id));
  const arrived = ARRIVALS.filter((a) => done.includes(a.id));
  const inHouseTotal = 15 + done.length;
  const ready = 2 - arrived.filter((a) => a.clean).length;
  const checkIn = (id: string) => {
    const a = ARRIVALS.find((x) => x.id === id)!;
    setDone((d) => [...d, id]);
    setNote(`${a.guest} checked in to room ${a.room}. The booking moved to In house.`);
  };
  return (
    <Frame title="Front desk">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={ArrowDownRight} tone="success" label="Arrivals today" value={waiting.length} />
        <StatTile icon={BedDouble} tone="info" label="In-house guests" value={inHouseTotal} />
        <StatTile icon={ArrowUpRight} tone="warning" label="Departures today" value={2} />
        <StatTile icon={Sparkles} tone="success" label="Rooms ready" value={ready} sub="Vacant and clean" />
      </div>
      <Segment label="Front desk lists" value={view} onChange={setView} options={[
        { v: "arrivals", label: `Arrivals (${waiting.length})` }, { v: "in-house", label: `In house (${inHouseTotal})` }, { v: "departures", label: "Departures today (2)" }]} />
      {view === "arrivals" && (
        <Table>
          <TableHeader><TableRow><TableHead>Guest</TableHead><TableHead>Stay</TableHead><TableHead>Room</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Deposit due</TableHead><TableHead className="w-28" /></TableRow></TableHeader>
          <TableBody>
            {waiting.length === 0 && <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">No arrivals waiting. Everyone is checked in.</TableCell></TableRow>}
            {waiting.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-semibold">{a.guest}</TableCell>
                <TableCell>{a.stay}</TableCell>
                <TableCell><span className="inline-flex flex-wrap items-center gap-2"><Room n={a.room} type={a.type} />{a.clean ? <Badge variant="success">Clean</Badge> : <Badge variant="warning">Dirty</Badge>}</span></TableCell>
                <TableCell><Badge variant="success">Confirmed</Badge></TableCell>
                <TableCell className="tabular text-right">{a.deposit}</TableCell>
                <TableCell className="text-right"><Button type="button" size="sm" aria-label={`Check in ${a.guest}`} onClick={() => checkIn(a.id)}>Check in</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {view !== "arrivals" && (
        <Table>
          <TableHeader><TableRow><TableHead>Room</TableHead><TableHead>Guest</TableHead><TableHead>Departure</TableHead></TableRow></TableHeader>
          <TableBody>
            {(view === "in-house" ? [...arrived.map((a) => ({ room: a.room, type: a.type, guest: a.guest, out: "Just arrived", due: false })), ...IN_HOUSE] : IN_HOUSE.filter((r) => r.due)).map((r) => (
              <TableRow key={r.room}>
                <TableCell><Room n={r.room} type={r.type} /></TableCell>
                <TableCell className="font-semibold">{r.guest}</TableCell>
                <TableCell>{r.out}{r.due && <Badge variant="warning" className="ml-2">Due out</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {view === "in-house" && <p className="text-xs text-muted-foreground">Showing a few of the {inHouseTotal} guests in house.</p>}
      <Note text={note} hint="Try it: select Check in on a guest." onReset={() => { setDone([]); setNote(""); }} />
    </Frame>
  );
}

/* ---------- Rooms ---------- */

type RoomState = "occ" | "clean" | "dirty" | "ooo";
const FLOORS: { name: string; rooms: [string, RoomState][] }[] = [
  { name: "Floor 1", rooms: [["101", "occ"], ["102", "occ"], ["103", "occ"], ["104", "dirty"], ["105", "occ"], ["106", "clean"], ["107", "occ"], ["108", "occ"], ["109", "occ"], ["110", "ooo"]] },
  { name: "Floor 2", rooms: [["201", "occ"], ["202", "occ"], ["203", "clean"], ["204", "occ"], ["205", "occ"], ["206", "occ"], ["207", "dirty"], ["208", "occ"], ["209", "occ"], ["210", "occ"]] },
];
const TYPE_OF: Record<string, string> = { "104": "Standard", "106": "Deluxe", "203": "Suite" };
const typeOf = (n: string) => TYPE_OF[n] ?? (["Standard", "Deluxe", "Standard", "Suite"][Number(n.slice(-1)) % 4] as string);
const STEPS = ["Dirty", "Assigned", "In progress", "Waiting inspection", "Clean"];
type Filter = "all" | "ready" | "occupied" | "dirty" | "blocked";

function Rooms() {
  const [steps, setSteps] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [note, setNote] = useState("");
  const stepOf = (n: string) => steps[n] ?? 0;
  const cond = (n: string, s: RoomState): RoomState => (s === "dirty" && stepOf(n) === 4 ? "clean" : s);
  const all = FLOORS.flatMap((f) => f.rooms.map(([n, s]) => ({ n, s: cond(n, s) })));
  const count = (s: RoomState) => all.filter((r) => r.s === s).length;
  const shown = (s: RoomState) => filter === "all" || (filter === "ready" && s === "clean") || (filter === "occupied" && s === "occ") || (filter === "dirty" && s === "dirty") || (filter === "blocked" && s === "ooo");
  const advance = (n: string) => {
    const next = stepOf(n) + 1;
    setSteps((p) => ({ ...p, [n]: next }));
    setNote(next === 4 ? `Room ${n} passed inspection. It is clean and ready to sell.` : `Room ${n} cleaning task: ${STEPS[next]}.`);
  };
  return (
    <Frame title="Room board">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <StatTile icon={BedDouble} tone="success" label="Ready to sell tonight" value={count("clean")} sub="Vacant, clean and sellable" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([["Occupied", count("occ"), "info"], ["Vacant clean", count("clean"), "success"], ["Vacant dirty", count("dirty"), "warning"], ["Not sellable", count("ooo"), "danger"]] as const).map(([l, c, t]) => (
            <div key={l} className="rounded-xl border border-border/70 bg-background p-3"><Badge variant={t}>{l}</Badge><p className="mt-1.5 text-2xl font-bold tabular">{c}</p></div>
          ))}
        </div>
      </div>
      <Segment label="Room filter" value={filter} onChange={setFilter} options={[
        { v: "all", label: "All rooms" }, { v: "ready", label: "Ready to sell" }, { v: "occupied", label: "Occupied" }, { v: "dirty", label: "Dirty" }, { v: "blocked", label: "Not sellable" }]} />
      {FLOORS.map((f) => {
        const rooms = f.rooms.filter(([n, s]) => shown(cond(n, s)));
        if (rooms.length === 0) return null;
        return (
          <section key={f.name} aria-label={f.name}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{f.name}</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
              {rooms.map(([n, s0]) => {
                const s = cond(n, s0);
                const dirty = s0 === "dirty" && stepOf(n) < 4;
                const chip = s === "occ" ? <Badge variant="info" dot>In house</Badge> : s === "clean" ? <Badge variant="success" dot>Clean</Badge>
                  : s === "ooo" ? <Badge variant="danger" dot>Out of order</Badge> : <Badge variant="warning" dot className="whitespace-normal text-left">{STEPS[stepOf(n)]}</Badge>;
                const body = (<><span className="flex items-baseline justify-between gap-2"><span className="text-lg font-bold">{n}</span><span className="text-xs text-muted-foreground">{typeOf(n)}</span></span><span className="mt-2 block">{chip}</span></>);
                return dirty
                  ? <button key={n} type="button" onClick={() => advance(n)} aria-label={`Room ${n}, ${typeOf(n)}, ${STEPS[stepOf(n)]}. Move the cleaning task to ${STEPS[stepOf(n) + 1]}.`}
                      className="cursor-pointer rounded-lg border border-warning/50 bg-warning-soft/40 p-3 text-left outline-none transition-colors hover:bg-warning-soft focus-visible:ring-2 focus-visible:ring-ring">{body}</button>
                  : <div key={n} className="rounded-lg border border-border/70 bg-background p-3">{body}</div>;
              })}
            </div>
          </section>
        );
      })}
      <Note text={note} hint="Try it: select a dirty room to move its cleaning task along." onReset={() => { setSteps({}); setNote(""); }} />
    </Frame>
  );
}

/* ---------- Money ---------- */

const CHARGES = ["Room, night 1", "Room, night 2", "Room, night 3"];

function Money() {
  const [paid, setPaid] = useState(false);
  const [note, setNote] = useState("");
  return (
    <Frame title="Guest folio">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <StatTile icon={Wallet} tone={paid ? "success" : "warning"} label={paid ? "Balance" : "Balance due"} value={paid ? "0" : "26,000"} sub={paid ? "Settled" : "Guest A · Room 106"} />
        <div className="flex flex-wrap content-center items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled title="Not part of this sample">Post charge</Button>
          <Button type="button" size="sm" disabled={paid} onClick={() => { setPaid(true); setNote("Payment recorded on the folio. The balance is now 0 and the folio is settled."); }}>Record payment</Button>
          <Button type="button" size="sm" variant="outline" disabled title="Not part of this sample">Split folio</Button>
          <Button type="button" size="sm" variant="outline" disabled title="Not part of this sample">Transfer</Button>
        </div>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
        <TableBody>
          {CHARGES.map((c) => <TableRow key={c}><TableCell>Charge</TableCell><TableCell>{c}</TableCell><TableCell className="tabular text-right">12,000</TableCell></TableRow>)}
          <TableRow><TableCell>Payment</TableCell><TableCell>Deposit, cash</TableCell><TableCell className="tabular text-right">-10,000</TableCell></TableRow>
          {paid && <TableRow className="status-swap"><TableCell>Payment</TableCell><TableCell>Card</TableCell><TableCell className="tabular text-right">-26,000</TableCell></TableRow>}
        </TableBody>
      </Table>
      <Note text={note} hint="Try it: select Record payment." onReset={() => { setPaid(false); setNote(""); }} />
    </Frame>
  );
}

/* ---------- Reports ---------- */

function Reports() {
  const [view, setView] = useState<"kpi" | "revenue">("kpi");
  return (
    <Frame title="Reports">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Percent} tone="info" label="Occupancy" value="75%" sub="15 of 20 rooms sold" />
        <StatTile icon={TrendingUp} tone="accent" label="ADR" value="12,000" sub="Average daily rate" />
        <StatTile icon={BarChart3} tone="accent" label="RevPAR" value="9,000" sub="Revenue per available room" />
        <StatTile icon={Coins} tone="success" label="Revenue" value="180,000" sub="One business day" />
      </div>
      <div>
        <div role="img" aria-label="15 of 20 rooms sold" className="grid grid-cols-20 gap-1" style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}>
          {Array.from({ length: 20 }, (_, i) => <span key={i} className={cn("h-3 rounded-sm", i < 15 ? "bg-primary" : "bg-muted")} />)}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">Rooms sold, 15 of 20</p>
      </div>
      <Segment label="Report views" value={view} onChange={setView} options={[{ v: "kpi", label: "Daily KPIs" }, { v: "revenue", label: "Revenue by charge code" }]} />
      {view === "kpi" ? (
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Available</TableHead><TableHead className="text-right">Sold</TableHead><TableHead className="text-right">Occupancy</TableHead><TableHead className="text-right">ADR</TableHead><TableHead className="text-right">RevPAR</TableHead><TableHead className="text-right">Room revenue</TableHead><TableHead className="text-right">Total revenue</TableHead></TableRow></TableHeader>
          <TableBody><TableRow className="status-swap"><TableCell>Sample day</TableCell>{["20", "15", "75%", "12,000", "9,000", "180,000", "180,000"].map((v, i) => <TableCell key={i} className="tabular text-right">{v}</TableCell>)}</TableRow></TableBody>
        </Table>
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Charge code</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
          <TableBody><TableRow className="status-swap"><TableCell>Room</TableCell><TableCell>Room</TableCell><TableCell className="tabular text-right">180,000</TableCell></TableRow></TableBody>
        </Table>
      )}
      <div className="flex justify-end"><Button type="button" size="sm" variant="outline" disabled title="Not part of this sample">Export CSV</Button></div>
    </Frame>
  );
}

export default function PreviewPanel({ kind }: { kind: PreviewKind }) {
  return kind === "front-desk" ? <FrontDesk /> : kind === "rooms" ? <Rooms /> : kind === "money" ? <Money /> : <Reports />;
}

import { useEffect, useState } from "react";
import { Section, Eyebrow } from "@/components/public/public-layout";
import { m, MotionRoot, useCalm } from "@/components/public/home/motion-kit";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/*
 * Section 3: drawn samples of four real screens (front desk arrivals, room board, guest folio, daily report),
 * built from the app's own chips and tokens. Sample data only. Amounts and results are hidden on purpose:
 * the page shows how the screens work, not hotel performance.
 */
/** False at first, true after a short pause, only when motion is allowed. Without motion the sample shows its resting state. */
function useSettled(delayMs = 1800): boolean {
  const calm = useCalm();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!calm) return;
    const t = setTimeout(() => setDone(true), delayMs);
    return () => clearTimeout(t);
  }, [calm, delayMs]);
  return done;
}

const Frame = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const calm = useCalm();
  return (
  <m.div className="rounded-xl border border-border/70 bg-card p-5 shadow-card sm:p-6"
    initial={calm ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}>
    <div className="flex items-center justify-between gap-3">
      <p className="text-[15px] font-bold">{title}</p>
      <Badge variant="neutral">Sample data</Badge>
    </div>
    <div className="mt-4">{children}</div>
  </m.div>
  );
};

const Line = ({ children }: { children: React.ReactNode }) => <div className="flex items-center justify-between gap-3 border-b border-border/60 py-3 text-sm last:border-0">{children}</div>;
const Bar = ({ w }: { w: string }) => <span aria-hidden className={`block h-3 rounded bg-muted ${w}`} />;

function FrontDesk() {
  const settled = useSettled();
  return (
    <Frame title="Arrivals today">
      <Line><span className="font-semibold">Guest A · Deluxe</span><Badge variant="success" dot>Ready</Badge></Line>
      <Line><span className="font-semibold">Guest B · Standard</span>{settled ? <Badge key="r" variant="success" dot className="status-swap">Ready</Badge> : <Badge key="d" variant="warning" dot>Dirty</Badge>}</Line>
      <Line><span className="font-semibold">Guest C · Suite</span><Badge variant="success" dot>Ready</Badge></Line>
    </Frame>
  );
}

const ROOMS: { n: string; label: string; variant: "success" | "warning" | "info" | "danger" }[] = [
  { n: "101", label: "Clean", variant: "success" }, { n: "102", label: "Dirty", variant: "warning" },
  { n: "103", label: "In house", variant: "info" }, { n: "201", label: "Out of order", variant: "danger" },
];

function Rooms() {
  return (
    <Frame title="Room board">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ROOMS.map((r) => (
          <div key={r.n} className="rounded-lg border border-border/70 bg-background p-3 text-center">
            <p className="text-lg font-bold">{r.n}</p>
            <Badge variant={r.variant} className="mt-1.5">{r.label}</Badge>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function Money() {
  const calm = useCalm();
  const settled = useSettled(1600);
  const due = calm && !settled;
  return (
    <Frame title="Guest folio">
      <Line><span>Room, 2 nights</span><Bar w="w-20" /></Line>
      <Line><span>Payment</span><Bar w="w-20" /></Line>
      <Line><span className="font-bold">Balance</span>{due
        ? <span className="flex items-center gap-2"><Bar w="w-12" /><Badge variant="warning">Due</Badge></span>
        : <span className="status-swap flex items-center gap-2"><span className="font-bold">0</span><Badge variant="success">Settled</Badge></span>}</Line>
    </Frame>
  );
}

function Reports() {
  const kpis = [["Occupancy", "w-3/5"], ["ADR", "w-2/5"], ["RevPAR", "w-1/2"]] as const;
  return (
    <Frame title="Daily report">
      <div className="grid gap-3 sm:grid-cols-3">
        {kpis.map(([k, w]) => (
          <div key={k} className="rounded-lg border border-border/70 bg-background p-3">
            <p className="text-xs font-semibold text-muted-foreground">{k}</p>
            <span aria-hidden className="mt-2 block h-2 w-full rounded bg-muted"><span className={`kpi-fill block h-2 rounded bg-primary ${w}`} /></span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs font-semibold text-muted-foreground">Revenue by charge code</p>
      <div aria-hidden className="mt-2 flex h-16 items-end gap-2">
        {[28, 44, 20, 36, 52].map((h, i) => <span key={i} className="bar-rise w-8 rounded-t bg-primary/70" style={{ height: h, animationDelay: `${i * 0.08}s` }} />)}
      </div>
    </Frame>
  );
}

const TABS = [
  { v: "front-desk", label: "Front desk", body: <FrontDesk /> },
  { v: "rooms", label: "Rooms", body: <Rooms /> },
  { v: "money", label: "Money", body: <Money /> },
  { v: "reports", label: "Reports", body: <Reports /> },
];

export function Preview() {
  return (
    <MotionRoot>
    <Section className="pt-0 sm:pt-0">
      <div id="preview" className="scroll-mt-24">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Product preview</Eyebrow>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">See Zikora in action.</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">Samples of the screens your team works in.</p>
        </div>
        <Tabs defaultValue="front-desk" className="mx-auto mt-8 max-w-3xl">
          <div className="flex justify-center">
            <TabsList aria-label="Zikora previews">
              {TABS.map((t) => <TabsTrigger key={t.v} value={t.v}>{t.label}</TabsTrigger>)}
            </TabsList>
          </div>
          {TABS.map((t) => <TabsContent key={t.v} value={t.v} className="mt-4">{t.body}</TabsContent>)}
        </Tabs>
        <p className="mt-4 text-center text-xs text-muted-foreground">Sample data. Not a live hotel account.</p>
      </div>
    </Section>
    </MotionRoot>
  );
}

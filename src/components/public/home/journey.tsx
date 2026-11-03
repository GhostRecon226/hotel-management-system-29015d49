import { Section, Eyebrow } from "@/components/public/public-layout";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { m, MotionRoot, useCalm } from "@/components/public/home/motion-kit";

/*
 * Section 2: one guest stay, as the hotel team handles it. The guest never uses Zikora.
 * Each step's small picture is a sample of a real screen moment (reservations, front desk, housekeeping, folio, dashboard).
 */
const Row = ({ children }: { children: React.ReactNode }) => <div className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-xs font-semibold">{children}</div>;
const Bar = ({ w }: { w: string }) => <span aria-hidden className={`block h-2.5 rounded bg-muted ${w}`} />;

const STEPS: { title: string; text: string; moment: React.ReactNode }[] = [
  { title: "A reservation is created", text: "The booking is recorded and availability is updated.",
    moment: <Row><span>Deluxe · 2 nights</span><Badge variant="success">Confirmed</Badge></Row> },
  { title: "Front desk checks in", text: "Staff assign a room and complete check-in.",
    moment: <Row><span>Room 102</span><Badge variant="info">In house</Badge></Row> },
  { title: "The room gets ready", text: "Housekeeping receives the task and updates room status.",
    moment: <Row><Badge variant="warning">Dirty</Badge><ArrowRight aria-hidden className="size-3.5 text-muted-foreground" /><Badge variant="success">Clean</Badge></Row> },
  { title: "The bill stays accurate", text: "Charges and payments are recorded in the guest folio.",
    moment: <div className="space-y-1.5"><Row><span>Room charge</span><Bar w="w-10" /></Row><Row><span>Payment</span><Bar w="w-10" /></Row></div> },
  { title: "The day closes", text: "Management reviews occupancy, revenue and daily activity.",
    moment: <Row><span>Daily report</span><span aria-hidden className="flex h-5 items-end gap-1">{[10, 16, 12, 20].map((h, i) => <span key={i} className="w-1.5 rounded-sm bg-primary" style={{ height: h }} />)}</span></Row> },
];

export function Journey() {
  const calm = useCalm();
  const once = { once: true, amount: 0.25 } as const;
  return (
    <MotionRoot>
      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>The operational journey</Eyebrow>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">One guest. One day. Everything connected.</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">One stay, handled by your team in one system.</p>
        </div>
        <ol key={calm ? "calm" : "still"} aria-label="A hotel day, step by step" className="relative mt-12 grid gap-8 lg:grid-cols-5 lg:gap-5">
          <m.div aria-hidden className="absolute bottom-6 left-5 top-5 origin-top border-l-2 border-dashed border-primary/40 lg:hidden"
            initial={calm ? { scaleY: 0 } : false} whileInView={{ scaleY: 1 }} viewport={once} transition={{ duration: 1.6, ease: "easeInOut" }} />
          <m.div aria-hidden className="absolute left-5 right-[calc(20%-1.25rem)] top-5 hidden origin-left border-t-2 border-dashed border-primary/40 lg:block"
            initial={calm ? { scaleX: 0 } : false} whileInView={{ scaleX: 1 }} viewport={once} transition={{ duration: 1.6, ease: "easeInOut" }} />
          {STEPS.map((s, i) => (
            <m.li key={s.title} className="relative pl-14 lg:pl-0 lg:pt-14"
              initial={calm ? { opacity: 0, y: 16 } : false} whileInView={{ opacity: 1, y: 0 }} viewport={once}
              transition={{ duration: 0.5, delay: calm ? i * 0.18 : 0, ease: "easeOut" }}>
              <span aria-hidden className="absolute left-0 top-0 grid size-10 place-items-center rounded-full border border-primary/30 bg-primary-soft text-sm font-bold text-primary-strong">{i + 1}</span>
              <h3 className="font-bold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-snug text-muted-foreground">{s.text}</p>
              <div aria-hidden className="mt-3 rounded-xl border border-border/70 bg-card p-3 shadow-card">{s.moment}</div>
            </m.li>
          ))}
        </ol>
      </Section>
    </MotionRoot>
  );
}

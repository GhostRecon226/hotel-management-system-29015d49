import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Section, Eyebrow } from "@/components/public/public-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MotionRoot } from "@/components/public/home/motion-kit";
import type { PreviewKind } from "@/components/public/home/preview/panels";

/*
 * Section 3: four sample screens of the real Zikora software (Front desk, Rooms, Money, Reports).
 * The panels are a separate file, fetched shortly before this section scrolls into view or when a tab is touched,
 * so they stay out of the first load. Sample Hotel data only; nothing here talks to a database.
 */
const Panel = lazy(() => import("@/components/public/home/preview/panels"));

const TABS: { v: PreviewKind; label: string }[] = [
  { v: "front-desk", label: "Front desk" }, { v: "rooms", label: "Rooms" }, { v: "money", label: "Money" }, { v: "reports", label: "Reports" },
];

function Waiting() {
  return <div aria-hidden className="min-h-[26rem] animate-pulse motion-reduce:animate-none rounded-xl border border-border/70 bg-card p-6 shadow-card"><div className="h-4 w-32 rounded bg-muted" /><div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-muted/60" />)}</div></div>;
}

export function Preview() {
  const [near, setNear] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || near) return;
    if (!("IntersectionObserver" in window)) { setNear(true); return; }
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return (
    <MotionRoot>
      <Section className="pt-0 sm:pt-0">
        <div id="preview" ref={box} className="scroll-mt-24">
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>Product preview</Eyebrow>
            <h2 className="mt-4 font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">See Zikora in action.</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">Samples of the screens your team works in.</p>
          </div>
          <Tabs defaultValue="front-desk" className="mx-auto mt-8 max-w-4xl">
            <div className="flex justify-center" onFocus={() => setNear(true)} onPointerEnter={() => setNear(true)}>
              <TabsList aria-label="Zikora previews">
                {TABS.map((t) => <TabsTrigger key={t.v} value={t.v}>{t.label}</TabsTrigger>)}
              </TabsList>
            </div>
            {TABS.map((t) => (
              <TabsContent key={t.v} value={t.v} className="mt-4">
                {near ? <Suspense fallback={<Waiting />}><Panel kind={t.v} /></Suspense> : <Waiting />}
              </TabsContent>
            ))}
          </Tabs>
          <p className="mt-4 text-center text-xs text-muted-foreground">Sample Data. Not a live hotel account.</p>
        </div>
      </Section>
    </MotionRoot>
  );
}

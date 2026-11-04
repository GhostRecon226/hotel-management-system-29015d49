import { useEffect, useState, type ReactNode } from "react";
import { LazyMotion, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";

/*
 * Motion for React, loaded lazily. The animation features come in a separate file after the page is shown,
 * so they stay out of the first load (PLT-023). Pages are complete and readable without any of this.
 */
export { m };

const loadFeatures = () => import("./motion-features").then((r) => r.default);

export function MotionRoot({ children }: { children: ReactNode }) {
  return <LazyMotion features={loadFeatures} strict>{children}</LazyMotion>;
}

/** True only in the browser, after the page has started, and only when the visitor allows motion. */
export function useCalm(): boolean {
  const reduce = useReducedMotion();
  const [armed, setArmed] = useState(false);
  useEffect(() => setArmed(true), []);
  return armed && !reduce;
}

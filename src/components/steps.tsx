import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** A row of numbered steps with the current one marked. Words as well as colour, so colour is never the only signal. */
export function Steps({ labels, at, allDone = false, label = "Progress" }: { labels: string[]; at: number; allDone?: boolean; label?: string }) {
  return (
    <ol aria-label={label} className="mb-4 flex">
      {labels.map((text, i) => {
        const state = allDone || i < at ? "done" : i === at ? "now" : "next";
        return (
          <li key={text} aria-current={state === "now" ? "step" : undefined} className="relative flex-1 pt-7 text-center text-xs sm:text-sm">
            {i > 0 && <span aria-hidden className={cn("absolute left-[-50%] top-[13px] h-0.5 w-full", i <= at || allDone ? "bg-primary" : "bg-border")} />}
            <span aria-hidden className={cn("absolute left-1/2 top-0 z-10 grid size-7 -translate-x-1/2 place-items-center rounded-full text-xs font-bold",
              state === "next" ? "bg-border text-muted-foreground" : "bg-primary text-primary-foreground", state === "now" && "ring-4 ring-primary/20")}>
              {state === "done" ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={cn(state === "now" ? "font-bold text-foreground" : "text-muted-foreground")}>{text}</span>
            {state === "now" && <span className="sr-only"> (current step)</span>}
          </li>
        );
      })}
    </ol>
  );
}

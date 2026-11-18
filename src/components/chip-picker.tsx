import { cn } from "@/lib/utils";

/** Round buttons for one-tap choices. Single choice marks the pressed one; the caller decides what a tap does. */
export function ChipPicker({ label, options, selected, onPick }: { label: string; options: { key: string; label: string }[]; selected: string | string[]; onPick: (key: string) => void }) {
  const on = (k: string) => (Array.isArray(selected) ? selected.includes(k) : selected === k);
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.key} type="button" aria-pressed={on(o.key)} onClick={() => onPick(o.key)}
          className={cn("min-h-11 rounded-full border px-3.5 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
            on(o.key) ? "border-transparent bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

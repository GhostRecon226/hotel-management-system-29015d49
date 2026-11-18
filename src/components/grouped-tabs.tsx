import { TabsList, TabsTrigger } from "@/components/ui/tabs";

export type TabGroup = { label: string; items: { value: string; label: string }[] };

/**
 * Tabs in named groups. From tablet width up the groups are a list down the left side; on a phone the same choices are one
 * drop-down. Use it inside a Radix `Tabs` that is controlled by the page (`value`, `onChange`), so both ways pick the same tab.
 */
export function GroupedTabs({ groups, value, onChange, label, layout = "rail" }: {
  groups: TabGroup[]; value: string; onChange: (value: string) => void; label: string;
  /** "rail" is a list down the left; "rows" is one labelled row per group above wide content such as report tables. */
  layout?: "rail" | "rows";
}) {
  return (
    <>
      <div className="md:hidden">
        <label htmlFor="grouped-tabs-select" className="sr-only">{label}</label>
        <select id="grouped-tabs-select" value={value} onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full rounded-lg border border-input bg-card px-3 text-base font-semibold">
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      {layout === "rows" ? (
        <TabsList aria-label={label} className="hidden h-auto w-full flex-wrap items-center justify-start gap-x-8 gap-y-2 overflow-visible rounded-xl border-border p-3 md:flex">
          {groups.map((g) => (
            <div key={g.label} role="presentation" className="flex flex-wrap items-center gap-1">
              <span role="presentation" className="pr-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{g.label}</span>
              {g.items.map((i) => <TabsTrigger key={i.value} value={i.value} className="min-h-9 px-3">{i.label}</TabsTrigger>)}
            </div>
          ))}
        </TabsList>
      ) : (
      <TabsList aria-label={label} className="hidden h-auto w-52 shrink-0 flex-col items-stretch gap-0.5 overflow-visible rounded-xl border-border bg-sidebar p-2 text-sidebar-foreground md:flex">
        {groups.map((g) => (
          <div key={g.label} role="presentation" className="flex flex-col gap-0.5">
            <span role="presentation" className="px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground first:pt-1">{g.label}</span>
            {g.items.map((i) => (
              <TabsTrigger key={i.value} value={i.value} className="min-h-10 justify-start whitespace-normal rounded-lg px-3 py-2 text-left text-sm font-medium data-[state=active]:bg-sidebar-accent data-[state=active]:font-bold data-[state=active]:text-sidebar-accent-foreground">
                {i.label}
              </TabsTrigger>
            ))}
          </div>
        ))}
      </TabsList>
      )}
    </>
  );
}

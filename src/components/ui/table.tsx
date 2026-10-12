import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * On a phone or small tablet (under 768px) every row becomes a small card of label and value pairs, so nothing is cut off and nobody
 * scrolls sideways. The labels come from the column headings. Pass `scroll` for a real grid (a calendar, a matrix):
 * it keeps its columns and scrolls inside its own box. Pass `wide` for a table with 8 or more columns: it is cards on tablets too. The card styles are in src/styles.css.
 */
function useCardLabels(table: HTMLTableElement | null, on: boolean) {
  React.useEffect(() => {
    if (!table || !on) return;
    const label = () => {
      const heads = Array.from(table.querySelectorAll("thead tr:last-child th"));
      const names: string[] = [];
      for (const h of heads) {
        const span = Number((h as HTMLTableCellElement).colSpan) || 1;
        for (let i = 0; i < span; i++) names.push((h.textContent ?? "").replace(/\s+/g, " ").trim());
      }
      for (const row of Array.from(table.querySelectorAll("tbody tr, tfoot tr"))) {
        let col = 0;
        for (const cell of Array.from(row.children) as HTMLTableCellElement[]) {
          const span = cell.colSpan || 1;
          const text = span > 1 ? "" : (names[col] ?? "");
          if (cell.getAttribute("data-label") !== text) cell.setAttribute("data-label", text);
          // A cell with no text and nothing to press is left out of the card.
          const empty = !(cell.textContent ?? "").trim() && !cell.querySelector("button, a, input, select, svg, img, [role=checkbox]");
          if (empty !== cell.hasAttribute("data-empty")) cell.toggleAttribute("data-empty", empty);
          col += span;
        }
      }
    };
    label();
    const watch = new MutationObserver(label);
    watch.observe(table, { childList: true, subtree: true, characterData: true });
    return () => watch.disconnect();
  }, [table, on]);
}

type TableProps = React.HTMLAttributes<HTMLTableElement> & { scroll?: boolean; wide?: boolean };

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, scroll = false, wide = false, ...props }, ref) => {
    const [el, setEl] = React.useState<HTMLTableElement | null>(null);
    const setRef = React.useCallback((node: HTMLTableElement | null) => {
      setEl(node);
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLTableElement | null>).current = node;
    }, [ref]);
    useCardLabels(el, !scroll);
    return (
      <div className="table-box relative w-full overflow-auto rounded-xl border border-border/70 shadow-card">
        <table
          ref={setRef}
          role="table"
          data-cards={scroll ? undefined : wide ? "wide" : ""}
          data-scroll={scroll ? "" : undefined}
          className={cn("w-full caption-bottom text-sm [&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4", className)}
          {...props}
        />
      </div>
    );
  },
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} role="rowgroup" className={cn("sticky top-0 z-10 bg-surface [&_tr]:border-b [&_tr]:hover:bg-transparent", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} role="rowgroup" className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    role="rowgroup"
    className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      role="row"
      className={cn(
        "border-b border-border/70 transition-colors hover:bg-primary-tint data-[state=selected]:bg-primary-soft",
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    role="columnheader"
    className={cn(
      "h-10 whitespace-nowrap px-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    role="cell"
    className={cn(
      "h-11 px-3 py-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
));
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };

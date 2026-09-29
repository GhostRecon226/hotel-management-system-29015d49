import type { ReactNode } from "react";
import { Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableCell, TableRow } from "@/components/ui/table";

/** Friendly empty state: an icon, a short title, one line of help and an optional action. */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: {
  icon?: typeof Inbox; title: string; description?: string; action?: ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-4 py-10 text-center", className)}>
      <div className="mb-1 grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-6" />
      </div>
      <p className="text-base font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-10 text-muted-foreground", className)} role="status">
      <Loader2 className="size-5 animate-spin" /> <span className="text-sm">{label}</span>
    </div>
  );
}

/** Empty or loading row inside a table. */
export function TableStateRow({ colSpan, loading, title, description, action }: {
  colSpan: number; loading?: boolean; title: string; description?: string; action?: ReactNode;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="h-auto p-0">
        {loading ? <LoadingState label={title} /> : <EmptyState title={title} description={description} action={action} />}
      </TableCell>
    </TableRow>
  );
}

/** Skeleton rows while a table loads. */
export function TableSkeletonRows({ rows = 5, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r} className="hover:bg-transparent">
          {Array.from({ length: cols }).map((__, c) => (
            <TableCell key={c}><div className="h-4 w-3/4 animate-pulse rounded bg-muted" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Page title, one line of help, and page actions on the right. */
export function PageHeader({ title, description, actions, className }: {
  title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string;
}) {
  return (
    <header className={cn("mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold tracking-tight sm:text-[26px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** Row of filters above a table: search on the left, other filters beside it. */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-3 flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

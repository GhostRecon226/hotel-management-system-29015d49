import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useAccess } from "@/lib/access";
import { NoAccess } from "@/lib/setup";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_app/housekeeping")({
  head: () => ({
    meta: [
      { title: "Housekeeping — Hotel Desk" },
      { name: "description", content: "Cleaning tasks, inspections and lost and found for your property." },
      { property: "og:title", content: "Housekeeping — Hotel Desk" },
      { property: "og:description", content: "Cleaning tasks, inspections and lost and found for your property." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HousekeepingLayout,
});

function HousekeepingLayout() {
  const { can, canAny } = useAccess();
  if (!can("hk.view") && !can("fo.view")) return <NoAccess />;
  const tabs = [
    { to: "/housekeeping" as const, label: "Board", show: canAny(["hk.task.assign", "hk.view"]), exact: true },
    { to: "/housekeeping/my-tasks" as const, label: "My tasks", show: can("hk.task.complete"), exact: false },
    { to: "/housekeeping/inspections" as const, label: "Inspections", show: can("hk.inspect"), exact: false },
    { to: "/housekeeping/minibar" as const, label: "Minibar", show: canAny(["hk.minibar.record", "setup.minibar.manage"]), exact: false },
    { to: "/housekeeping/lost-found" as const, label: "Lost and found", show: true, exact: false },
  ].filter((t) => t.show);
  return (
    <div>
      <nav aria-label="Housekeeping" className="mb-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-border/70 bg-card p-1 shadow-xs">
        {tabs.map((t) => (
          <Link key={t.to} to={t.to} activeOptions={{ exact: t.exact }}
            className={cn("flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40")}
            activeProps={{ className: "bg-primary-soft !text-primary-strong" }}>
            {t.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}

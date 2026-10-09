import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useAccess } from "@/lib/access";
import { SETUP_PERMS } from "@/lib/setup";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/_app/setup")({
  head: () => ({
    meta: [
      { title: "Setup — Zikora" },
      { name: "description", content: "Property, rooms, rates, taxes and payment settings." },
      { property: "og:title", content: "Setup — Zikora" },
      { property: "og:description", content: "Property, rooms, rates, taxes and payment settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetupLayout,
});

const TABS = [
  { to: "/setup/property", label: "Property details", perms: ["setup.property.view", "setup.property.edit"] },
  { to: "/setup/room-types", label: "Room types", perms: ["setup.room.manage"] },
  { to: "/setup/rooms", label: "Rooms", perms: ["setup.room.manage"] },
  { to: "/setup/rates", label: "Rate plans & prices", perms: ["setup.rate.manage"] },
  { to: "/setup/charges", label: "Tax, charges & payments", perms: ["setup.tax.manage"] },
  { to: "/setup/exchange-rates", label: "Exchange rates", perms: ["setup.rate.manage"] },
] as const;

function SetupLayout() {
  const { canAny, property } = useAccess();
  if (!canAny(SETUP_PERMS)) {
    return <p className="text-sm text-muted-foreground">You do not have access to Setup for this property.</p>;
  }
  return (
    <div>
      <PageHeader title="Setup" description={`Settings for ${property?.name ?? "this property"}.`} className="mb-4" />
      <nav aria-label="Setup" className="mb-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-border/70 bg-card p-1 shadow-xs">
        {TABS.filter((t) => canAny([...t.perms])).map((t) => (
          <Link key={t.to} to={t.to}
            className="flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
            activeProps={{ className: "bg-primary-soft !text-primary-strong" }}>
            {t.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}


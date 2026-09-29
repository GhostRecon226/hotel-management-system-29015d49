import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useAccess } from "@/lib/access";
import { SETUP_PERMS } from "@/lib/setup";

export const Route = createFileRoute("/_authenticated/_app/setup")({
  head: () => ({
    meta: [
      { title: "Setup — Hotel Desk" },
      { name: "description", content: "Property, rooms, rates, taxes and payment settings." },
      { property: "og:title", content: "Setup — Hotel Desk" },
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
      <h1 className="text-2xl font-semibold">Setup</h1>
      <p className="mb-4 text-sm text-muted-foreground">Settings for {property?.name}.</p>
      <nav className="mb-6 flex flex-wrap gap-1 border-b">
        {TABS.filter((t) => canAny([...t.perms])).map((t) => (
          <Link key={t.to} to={t.to}
            className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            activeProps={{ className: "!border-primary font-medium !text-foreground" }}>
            {t.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}

export function NoAccess() {
  return <p className="text-sm text-muted-foreground">You do not have permission to manage this.</p>;
}

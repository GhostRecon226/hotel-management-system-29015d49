import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useAccess } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/_app/guests")({
  head: () => ({
    meta: [
      { title: "Guests — Hotel Desk" },
      { name: "description", content: "Search, create and manage guest profiles." },
      { property: "og:title", content: "Guests — Hotel Desk" },
      { property: "og:description", content: "Search, create and manage guest profiles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuestsLayout,
});

function GuestsLayout() {
  const { can } = useAccess();
  if (!can("guest.view")) return <p className="text-sm text-muted-foreground">You do not have access to Guests.</p>;
  return <Outlet />;
}

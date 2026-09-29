import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useAccess } from "@/lib/access";
import { NoAccess } from "@/lib/setup";

export const Route = createFileRoute("/_authenticated/_app/rooms")({
  head: () => ({
    meta: [
      { title: "Rooms — Hotel Desk" },
      { name: "description", content: "See every room's condition, occupancy and blocks at a glance." },
      { property: "og:title", content: "Rooms — Hotel Desk" },
      { property: "og:description", content: "See every room's condition, occupancy and blocks at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoomsLayout,
});

function RoomsLayout() {
  const { can } = useAccess();
  if (!can("room.view")) return <NoAccess />;
  return <Outlet />;
}

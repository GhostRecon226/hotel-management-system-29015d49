import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useAccess } from "@/lib/access";
import { NoAccess } from "@/lib/setup";

export const Route = createFileRoute("/_authenticated/_app/reservations")({
  head: () => ({
    meta: [
      { title: "Reservations — Hotel Desk" },
      { name: "description", content: "Find, create and manage room bookings and see availability." },
      { property: "og:title", content: "Reservations — Hotel Desk" },
      { property: "og:description", content: "Find, create and manage room bookings and see availability." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReservationsLayout,
});

function ReservationsLayout() {
  const { can } = useAccess();
  if (!can("res.view")) return <NoAccess />;
  return <Outlet />;
}

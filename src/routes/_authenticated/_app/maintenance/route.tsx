import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useAccess } from "@/lib/access";
import { NoAccess } from "@/lib/setup";

export const Route = createFileRoute("/_authenticated/_app/maintenance")({
  head: () => ({
    meta: [
      { title: "Maintenance — Zikora" },
      { name: "description", content: "Report, assign and track repair tickets for rooms and public areas." },
      { property: "og:title", content: "Maintenance — Zikora" },
      { property: "og:description", content: "Report, assign and track repair tickets for rooms and public areas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MaintenanceLayout,
});

function MaintenanceLayout() {
  const { canAny } = useAccess();
  if (!canAny(["mnt.view", "mnt.ticket.create"])) return <NoAccess />;
  return <Outlet />;
}

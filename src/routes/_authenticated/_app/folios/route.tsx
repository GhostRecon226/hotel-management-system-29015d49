import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useAccess } from "@/lib/access";
import { NoAccess } from "@/lib/setup";

export const Route = createFileRoute("/_authenticated/_app/folios")({
  head: () => ({
    meta: [
      { title: "Folios — Hotel Desk" },
      { name: "description", content: "Guest bills: charges, payments and balances for every stay." },
      { property: "og:title", content: "Folios — Hotel Desk" },
      { property: "og:description", content: "Guest bills: charges, payments and balances for every stay." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FoliosLayout,
});

function FoliosLayout() {
  const { can } = useAccess();
  if (!can("fin.folio.view")) return <NoAccess />;
  return <Outlet />;
}

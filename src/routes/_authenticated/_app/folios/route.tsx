import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { FolioListPane } from "@/components/folio-list-pane";
import { useAccess } from "@/lib/access";
import { NoAccess } from "@/lib/setup";

export const Route = createFileRoute("/_authenticated/_app/folios")({
  head: () => ({
    meta: [
      { title: "Folios — Zikora" },
      { name: "description", content: "Guest bills: charges, payments and balances for every stay." },
      { property: "og:title", content: "Folios — Zikora" },
      { property: "og:description", content: "Guest bills: charges, payments and balances for every stay." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FoliosLayout,
});

// On a folio's page, wide screens show the open folios on the left and the folio on the right.
// The folio comes first in the page order, so the keyboard reaches it before the list.
function FoliosLayout() {
  const { can } = useAccess();
  const { id } = useParams({ strict: false }) as { id?: string };
  if (!can("fin.folio.view")) return <NoAccess />;
  if (!id) return <Outlet />;
  return (
    <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      <div className="min-w-0 xl:col-start-2 xl:row-start-1"><Outlet /></div>
      <FolioListPane activeId={id} className="hidden self-start xl:sticky xl:top-20 xl:col-start-1 xl:row-start-1 xl:block" />
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useAccess } from "@/lib/access";
import { NoAccess } from "@/lib/setup";
import { PageHeader } from "@/components/page-header";
import { emptyForm, ReservationForm } from "@/components/reservation-form";

export const Route = createFileRoute("/_authenticated/_app/reservations/new")({
  validateSearch: (s: Record<string, unknown>): { group?: string } => (typeof s["group"] === "string" ? { group: s["group"] } : {}),
  component: NewReservation,
});

function NewReservation() {
  const { property, can } = useAccess();
  const navigate = useNavigate();
  const { group } = Route.useSearch();
  if (!can("res.create")) return <NoAccess />;
  return (
    <div>
      <Link to="/reservations" className="mb-1 inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Reservations
      </Link>
      <PageHeader title="New booking" description={property?.name} />
      <ReservationForm mode="create" initial={{ ...emptyForm(property?.business_date ?? ""), ...(group ? { group_id: group } : {}) }}
        onDone={(id) => navigate({ to: "/reservations/$id", params: { id } })}
        onCancel={() => navigate({ to: "/reservations" })} />
    </div>
  );
}

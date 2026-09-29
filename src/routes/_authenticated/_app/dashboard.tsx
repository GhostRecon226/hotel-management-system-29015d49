import { createFileRoute } from "@tanstack/react-router";
import { useAccess } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Hotel Desk" },
      { name: "description", content: "Your hotel at a glance." },
      { property: "og:title", content: "Dashboard — Hotel Desk" },
      { property: "og:description", content: "Your hotel at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { ctx, property } = useAccess();
  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Welcome, {ctx.profile?.full_name}. {property ? `You are working in ${property.name}.` : "You are not assigned to any property yet."}
      </p>
    </div>
  );
}

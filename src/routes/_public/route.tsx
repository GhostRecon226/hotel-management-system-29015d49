import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PublicLayout } from "@/components/public/public-layout";

// Public pages: readable by everyone, signed in or not. Static content only; no database calls.
export const Route = createFileRoute("/_public")({
  component: () => <PublicLayout><Outlet /></PublicLayout>,
});

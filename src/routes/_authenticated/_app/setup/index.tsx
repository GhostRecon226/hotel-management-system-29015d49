import { createFileRoute, Navigate } from "@tanstack/react-router";
import { SetupChecklist } from "@/components/setup-checklist";
import { useSetupProgress } from "@/lib/setup-progress";
import { LoadingState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/_app/setup/")({ component: SetupHome });

/** Setup opens on the checklist while something is left to do, and on Property details once everything is done. */
function SetupHome() {
  const { data, isLoading, isError } = useSetupProgress();
  if (isLoading) return <LoadingState label="Checking your setup…" />;
  if (isError || !data || data.complete) return <Navigate to="/setup/property" replace />;
  return <SetupChecklist data={data} />;
}

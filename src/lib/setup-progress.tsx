import { useQuery } from "@tanstack/react-query";
import { useAccess } from "@/lib/access";
import { callRpc, SETUP_PERMS } from "@/lib/setup";

export interface SetupStep { key: string; label: string; detail: string; href: string; done: boolean }
export interface SetupProgress { property_id: string; total: number; done: number; complete: boolean; steps: SetupStep[] }

/** What is left to set up for the current property. The database works it out (setup_progress); nothing is stored. */
export function useSetupProgress() {
  const { property, canAny } = useAccess();
  const allowed = !!property && canAny(SETUP_PERMS);
  return useQuery({
    queryKey: ["setup", "progress", property?.id],
    enabled: allowed,
    queryFn: () => callRpc<SetupProgress>("setup_progress", { p_property_id: property!.id }),
  });
}

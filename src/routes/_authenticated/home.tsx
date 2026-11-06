import { createFileRoute, redirect } from "@tanstack/react-router";
import { myContextQuery } from "@/lib/queries";
import { landingPath } from "@/lib/landing";

/** The page people reach after sign-in. It shows nothing: it sends each person to their own first screen (FO-015). */
export const Route = createFileRoute("/_authenticated/home")({
  beforeLoad: async ({ context }) => {
    const ctx = await context.queryClient.ensureQueryData({ ...myContextQuery, revalidateIfStale: true });
    throw redirect({ to: landingPath(ctx), replace: true });
  },
  component: () => null,
});

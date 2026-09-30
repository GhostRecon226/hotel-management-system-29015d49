import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AccessProvider, myContextQuery } from "@/lib/access";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/_app")({
  beforeLoad: async ({ context }) => {
    const ctx = await context.queryClient.ensureQueryData({ ...myContextQuery, revalidateIfStale: true });
    if (!ctx.has_hotel && !ctx.disabled) throw redirect({ to: "/create-hotel" });
  },
  component: AppLayout,
});

function AppLayout() {
  const { data } = useSuspenseQuery(myContextQuery);
  if (data.disabled) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="max-w-sm text-sm">Your account has been disabled. Ask your hotel's System Administrator to re-enable it.</p>
      </div>
    );
  }
  return (
    <AccessProvider ctx={data}>
      <AppShell>
        <Outlet />
      </AppShell>
    </AccessProvider>
  );
}

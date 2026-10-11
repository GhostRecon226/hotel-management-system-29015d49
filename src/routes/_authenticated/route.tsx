import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { rememberUser, restoreSavedLists } from "@/lib/offline/cache";

/**
 * Who is signed in. Normally the server confirms it. With no connection the server cannot be reached, so the
 * sign-in saved on this device is used. That only lets the app open and show saved lists; the database still
 * checks the sign-in on every call.
 */
async function signedInUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (data.user) return data.user;
  const unreachable = !navigator.onLine || (error && (error.name === "AuthRetryableFetchError" || error.status === 0 || error.status === undefined));
  if (!unreachable) return null;
  const { data: saved } = await supabase.auth.getSession();
  return saved.session?.user ?? null;
}

export const Route = createFileRoute("/_authenticated")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  ssr: false,
  beforeLoad: async ({ context }) => {
    const user = await signedInUser();
    if (!user) throw redirect({ to: "/auth" });
    rememberUser(user.id);
    await restoreSavedLists(context.queryClient, user.id);
    return { user };
  },
  component: () => <Outlet />,
});

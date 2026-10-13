// Watches sign-in and sign-out for the whole app. Loaded only when a visitor has a saved sign-in or reaches a
// signed-in screen, so the public pages never download the sign-in library.
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clearOfflineData, rememberUser } from "@/lib/offline/cache";

export function watchAuth(queryClient: QueryClient, invalidate: () => void) {
  // Do not reload the router on sign-in. The sign-in page and the email link already navigate, and
  // the route guards check the session and the hotel context on that navigation. Reloading at the
  // same moment raced with the guards' redirect and left a blank page ("Uncaught undefined").
  // Supabase also repeats SIGNED_IN for the same person (email link, tab focus); that is ignored.
  let currentUserId: string | null | undefined;
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    const userId = session?.user.id ?? null;
    if (event === "INITIAL_SESSION") { currentUserId = userId; return; }
    if (event === "SIGNED_OUT") {
      currentUserId = null;
      queryClient.clear(); // never show one user's data to the next
      rememberUser(null);
      void clearOfflineData(); // and nothing stays saved on this device
      invalidate(); // guards send the user to /auth
      return;
    }
    if (event === "SIGNED_IN") {
      const switched = !!currentUserId && currentUserId !== userId;
      currentUserId = userId;
      if (switched) { queryClient.clear(); invalidate(); } // a different person in the same tab
      return;
    }
    if (event === "USER_UPDATED") {
      // Let checks that are already running finish instead of cancelling them.
      queryClient.invalidateQueries(undefined, { cancelRefetch: false });
    }
  });
  return () => data.subscription.unsubscribe();
}

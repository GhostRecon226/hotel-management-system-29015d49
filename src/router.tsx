import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    // Saving never waits for TanStack to think the network is back. A save that cannot reach the server either
    // fails with a clear message or, for queueable actions, waits on the device (src/lib/offline/queue.ts).
    defaultOptions: { mutations: { networkMode: "always" } },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};

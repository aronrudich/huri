import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { clearPersistedQueryCache } from "./lib/query-persist";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // In-memory only: keeps tab switches instant during a session.
        gcTime: 45 * 60 * 1000,
        // Resume refresh is handled once (debounced) by useRealtimeRecovery,
        // so focus doesn't fire a second burst of every query at unlock.
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 2,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
      },
    },
  });

  // Remove stale snapshots saved by older versions of the app.
  clearPersistedQueryCache();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    scrollToTopSelectors: [".app-scroll"],
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,

  });

  return router;
};


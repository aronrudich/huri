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
        // Keep retrying until the server answers, but spread phones out with
        // random jitter so a recovering database isn't hit by every phone at
        // the same instant. Existing data stays on screen the whole time.
        retry: 6,
        retryDelay: (attempt) => Math.min(3000 * 2 ** attempt, 30_000) + Math.random() * 5000,
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


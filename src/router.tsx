import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { attachQueryPersistence } from "./lib/query-persist";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Cached data must survive long enough to be worth writing to storage.
        gcTime: 24 * 60 * 60 * 1000,
        // Coming back to a suspended phone must re-check the server, and a
        // request killed mid-flight by sleep should retry instead of hanging.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: 2,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
      },
    },
  });

  attachQueryPersistence(queryClient);

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


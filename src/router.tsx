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


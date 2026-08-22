import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Fetch a tab's code as soon as the user touches/hovers its link, so the
    // tap itself doesn't wait on a network request.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,

  });

  return router;
};

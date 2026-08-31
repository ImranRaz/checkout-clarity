import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preload a route's data as soon as the pointer touches its link, and keep
    // that data warm long enough that the click itself is instant.
    defaultPreload: "intent",
    defaultPreloadDelay: 30,
    defaultPreloadStaleTime: 60_000,
    defaultPendingMs: 150,
    defaultPendingMinMs: 0,

  });

  return router;
};

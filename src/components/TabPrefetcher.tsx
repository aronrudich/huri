import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

const TAB_ROUTES = ["/", "/pickup", "/lot", "/profile"] as const;

/**
 * Warms the code for the four bottom-tab screens once the app is idle, so the
 * first tap on a tab renders without waiting on its chunk download. Only the
 * route chunk is loaded here — no loaders or queries run.
 */
export function TabPrefetcher() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    const warm = () => {
      if (cancelled) return;
      TAB_ROUTES.forEach((id) => {
        const route = router.routesById[id];
        if (route) void Promise.resolve(router.loadRouteChunk(route)).catch(() => {});
      });
    };

    const w = window as typeof window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(warm, { timeout: 3000 });
      return () => { cancelled = true; w.cancelIdleCallback?.(id); };
    }
    const t = setTimeout(warm, 1500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [router]);
  return null;
}

import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";

const KEY = "huri.query-cache.v2";
const MAX_AGE = 24 * 60 * 60 * 1000;

/**
 * Keeps the last known query data in localStorage so a cold start paints the
 * inbox / pickup list / lot immediately instead of waiting on the network.
 * Restore is synchronous (before the first render) and saving is debounced.
 */
export function attachQueryPersistence(queryClient: QueryClient) {
  if (typeof window === "undefined") return;

  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { savedAt?: number; state?: unknown };
      if (parsed?.state && Date.now() - (parsed.savedAt ?? 0) < MAX_AGE) {
        hydrate(queryClient, parsed.state);
      } else {
        window.localStorage.removeItem(KEY);
      }
    }
  } catch {
    try { window.localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    try {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({ savedAt: Date.now(), state: dehydrate(queryClient) }),
      );
    } catch {
      // Quota or private mode — the app just loses the warm start.
    }
  };

  queryClient.getQueryCache().subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, 1000);
  });
}

/**
 * Wipe the persisted cache. Called on every sign-out so a shared device never
 * paints the previous user's inbox, pickup list, or lot data.
 */
export function clearPersistedQueryCache() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}

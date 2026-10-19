import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Shown whenever a screen's data could not be loaded from the server. Lists
 * keep whatever they already had, and this banner makes it clear the empty or
 * old view is a connection problem — never that the cars or pickups are gone.
 */
export function ConnectionBanner() {
  const queryClient = useQueryClient();
  const [failing, setFailing] = useState(false);

  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const check = () => {
      const bad = cache
        .findAll({ type: "active" })
        .some((q) => q.state.status === "error" || (q.state.fetchFailureCount > 0 && q.state.fetchStatus === "fetching"));
      setFailing(bad);
    };
    check();
    return cache.subscribe(check);
  }, [queryClient]);

  if (!failing) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] bg-warning px-4 pb-2 text-center text-sm font-semibold text-warning-foreground shadow"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
    >
      Reconnecting to Huri… nothing has been deleted. Your list will refresh on its own.
    </div>
  );
}

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { syncPushSubscription } from "@/lib/push";

/**
 * Keeps this device's push subscription fresh. Browsers (especially iOS PWAs)
 * rotate or drop subscriptions; without this the saved endpoint goes dead and
 * notifications silently stop arriving.
 */
export function PushSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const run = () => { void syncPushSubscription(user.id); };
    run();
    const onVisible = () => { if (document.visibilityState === "visible") run(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user]);

  return null;
}

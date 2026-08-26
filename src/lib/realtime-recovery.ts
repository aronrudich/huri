import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * iOS suspends the realtime websocket while the app is in the background. When
 * the app comes back the socket is dead and no rows arrive anymore, which used
 * to require force-quitting the app. We bump a "generation" value whenever the
 * app returns to the foreground (or the network comes back) so every screen
 * re-subscribes its channels, and we refresh whatever is on screen.
 */
let generation = 0;
const listeners = new Set<(g: number) => void>();

export function bumpRealtimeGeneration() {
  generation += 1;
  listeners.forEach((fn) => fn(generation));
}

/** Re-subscribe key: include it in a channel effect's dependency array. */
export function useRealtimeGeneration(): number {
  const [gen, setGen] = useState(generation);
  useEffect(() => {
    listeners.add(setGen);
    return () => { listeners.delete(setGen); };
  }, []);
  return gen;
}

/**
 * Mounted once at the root. Rebuilds the realtime connection and refreshes the
 * active queries every time the app becomes visible again or reconnects.
 */
export function useRealtimeRecovery() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;
    let last = 0;

    const recover = () => {
      // Debounce: iOS fires visibility + focus + online in a burst.
      const now = Date.now();
      if (now - last < 1500) return;
      last = now;

      try {
        supabase.realtime.disconnect();
        supabase.realtime.connect();
      } catch (error) {
        console.warn("[realtime] reconnect failed", error);
      }
      bumpRealtimeGeneration();
      void queryClient.invalidateQueries({ type: "active" });
    };

    const onVisible = () => { if (document.visibilityState === "visible") recover(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", recover);
    window.addEventListener("pageshow", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", recover);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [queryClient]);
}

/**
 * Channel status handler: a dropped/errored channel triggers the same recovery
 * path, so a mid-session socket failure heals itself instead of going silent.
 */
export function handleChannelStatus(status: string) {
  if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
    setTimeout(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        bumpRealtimeGeneration();
      }
    }, 3000);
  }
}

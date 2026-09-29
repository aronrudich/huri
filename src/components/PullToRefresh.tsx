import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { reconnectRealtime } from "@/lib/realtime-recovery";

const TRIGGER_DISTANCE = 64;
const MAX_DISTANCE = 88;

export function PullToRefresh({ children }: { children: ReactNode }) {
  // Standalone customer pages (the arrival screen) must never pull-to-refresh:
  // hard flicks on the time drums would drag the whole page down.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const disabled = pathname.startsWith("/arrive");
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef<number | null>(null);
  const distanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (disabled) return;
    const scroller = scrollerRef.current;
    const indicator = indicatorRef.current;
    if (!scroller || !indicator) return;

    const setDistance = (distance: number) => {
      distanceRef.current = distance;
      indicator.style.height = `${distance}px`;
      indicator.dataset.ready = distance >= TRIGGER_DISTANCE ? "true" : "false";
    };

    const onTouchStart = (event: TouchEvent) => {
      if (refreshingRef.current || scroller.scrollTop > 0) return;
      startYRef.current = event.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (event: TouchEvent) => {
      const startY = startYRef.current;
      const currentY = event.touches[0]?.clientY;
      if (startY === null || currentY === undefined || scroller.scrollTop > 0) return;
      const rawDistance = currentY - startY;
      if (rawDistance <= 0) {
        setDistance(0);
        return;
      }
      event.preventDefault();
      setDistance(Math.min(MAX_DISTANCE, rawDistance * 0.48));
    };

    const finishPull = () => {
      startYRef.current = null;
      if (distanceRef.current < TRIGGER_DISTANCE || refreshingRef.current) {
        setDistance(0);
        return;
      }

      refreshingRef.current = true;
      setRefreshing(true);
      setDistance(52);
      reconnectRealtime();
      // Refresh quietly in the background; the spinner never waits on it.
      void queryClient.invalidateQueries({ type: "active", refetchType: "active" });
      window.setTimeout(() => {
        refreshingRef.current = false;
        setRefreshing(false);
        setDistance(0);
      }, 800);
    };

    const cancelPull = () => {
      if (refreshingRef.current) return;
      startYRef.current = null;
      setDistance(0);
    };

    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    scroller.addEventListener("touchmove", onTouchMove, { passive: false });
    scroller.addEventListener("touchend", finishPull);
    scroller.addEventListener("touchcancel", cancelPull);
    return () => {
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchmove", onTouchMove);
      scroller.removeEventListener("touchend", finishPull);
      scroller.removeEventListener("touchcancel", cancelPull);
    };
  }, [queryClient, disabled]);

  if (disabled) return <div className="app-scroll">{children}</div>;

  return (
    <div ref={scrollerRef} className="app-scroll">
      <div ref={indicatorRef} className="pull-refresh-indicator" aria-live="polite">
        <LoaderCircle className={`h-5 w-5 text-primary ${refreshing ? "animate-spin" : "pull-refresh-icon"}`} />
        <span className="sr-only">{refreshing ? "Updating" : "Pull to refresh"}</span>
      </div>
      {children}
    </div>
  );
}
import { useEffect, useRef, useState } from "react";
import { GpsPinTracker, isReadyGpsFix, type GpsFix } from "./gps-pin";

export function useGpsPin(enabled: boolean) {
  const tracker = useRef<GpsPinTracker | null>(null);
  const mounted = useRef(false);
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [refining, setRefining] = useState(false);
  useEffect(() => {
    mounted.current = true;
    if (!enabled) return () => { mounted.current = false; };
    if (!navigator.geolocation) {
      setError("This browser does not support location.");
      return () => { mounted.current = false; };
    }
    const current = new GpsPinTracker(navigator.geolocation, (next, message) => {
      if (mounted.current) { setFix(next); setError(message); }
    });
    tracker.current = current;
    current.start();
    setActive(true);
    const timer = setInterval(() => setFix(current.best()), 1_000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      current.stop();
      tracker.current = null;
    };
  }, [enabled]);
  return {
    fix, error, active, refining, ready: isReadyGpsFix(fix, Date.now()),
    acquire: async () => {
      if (!enabled || !tracker.current) throw new Error(error ?? "Location unavailable.");
      setActive(true);
      setRefining(!isReadyGpsFix(tracker.current.best(), Date.now()));
      try { return await tracker.current.acquire(); }
      finally { if (mounted.current) setRefining(false); }
    },
    stop: () => { tracker.current?.stop(); if (mounted.current) setActive(false); },
    isMounted: () => mounted.current,
  };
}
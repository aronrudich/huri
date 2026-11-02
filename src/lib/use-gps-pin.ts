import { createContext, createElement, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { GpsPinTracker, isReadyGpsFix, type GpsFix } from "./gps-pin";
import { watchForegroundGps } from "./gps-foreground";
import { useAuth } from "./auth-context";
import { isAronEmail } from "./aron";
import { isSpectatorRole } from "./roles";

type SharedGps = { tracker: GpsPinTracker | null; fix: GpsFix | null; error: string | null; active: boolean };
const GpsContext = createContext<SharedGps>({ tracker: null, fix: null, error: null, active: false });

export function GpsPinProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const enabled = !loading && !!user && !!profile?.dealership_id && isAronEmail(user.email)
    && profile.id === user.id && !isSpectatorRole(profile.role_name) && profile.is_active === true && profile.status === "approved";
  const [tracker, setTracker] = useState<GpsPinTracker | null>(null);
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    setFix(null); setError(null); setActive(false); setTracker(null);
    if (!enabled) return;
    if (!navigator.geolocation) {
      setError("This browser does not support location.");
      return;
    }
    const current = new GpsPinTracker(navigator.geolocation, (next, message) => {
      setFix(next); setError(message);
    });
    setTracker(current);
    const cleanup = watchForegroundGps(current, document, (visible) => {
      setActive(visible); setFix(current.best());
    });
    const timer = setInterval(() => setFix(current.best()), 1_000);
    return () => {
      clearInterval(timer);
      cleanup();
    };
  }, [enabled, user?.id, profile?.dealership_id]);
  return createElement(GpsContext.Provider, { value: enabled ? { tracker, fix, error, active } : { tracker: null, fix: null, error: null, active: false } }, children);
}

export function useGpsPin(enabled: boolean) {
  const shared = useContext(GpsContext);
  const mounted = useRef(false);
  const [refining, setRefining] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  return {
    fix: enabled ? shared.fix : null, error: shared.error, active: enabled && shared.active,
    refining, ready: enabled && isReadyGpsFix(shared.fix, Date.now()),
    acquire: async () => {
      if (!enabled || !shared.active || !shared.tracker) throw new Error(shared.error ?? "Location unavailable.");
      setRefining(!shared.tracker.best());
      try { return await shared.tracker.acquire(); }
      finally { if (mounted.current) setRefining(false); }
    },
    isMounted: () => mounted.current,
  };
}
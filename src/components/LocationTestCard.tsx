import { useEffect, useRef, useState } from "react";
import { Crosshair, Radio } from "lucide-react";

type Fix = {
  lat: number; lng: number; acc: number;
  alt: number | null; heading: number | null; speed: number | null; at: number;
};

const errText = (e: GeolocationPositionError) =>
  e.code === e.PERMISSION_DENIED ? "Location permission denied. Allow location access in your browser settings."
  : e.code === e.TIMEOUT ? "Timed out waiting for a GPS fix."
  : "Location unavailable on this device.";

/** Private diagnostics card — the caller gates rendering to Aron's accounts. */
export function LocationTestCard() {
  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [watching, setWatching] = useState(false);
  const [now, setNow] = useState(Date.now());
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(t); if (watchId.current !== null) navigator.geolocation?.clearWatch(watchId.current); };
  }, []);

  const ok = (p: GeolocationPosition) => {
    setBusy(false); setError(null);
    setFix({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, alt: p.coords.altitude, heading: p.coords.heading, speed: p.coords.speed, at: p.timestamp || Date.now() });
  };
  const fail = (e: GeolocationPositionError) => { setBusy(false); setError(errText(e)); };
  const opts = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

  const checkOnce = () => {
    if (!navigator.geolocation) return setError("This browser does not support location.");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(ok, fail, opts);
  };
  const toggleWatch = () => {
    if (!navigator.geolocation) return setError("This browser does not support location.");
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null; setWatching(false); return;
    }
    watchId.current = navigator.geolocation.watchPosition(ok, fail, opts);
    setWatching(true);
  };

  const row = (k: string, v: string) => (
    <div className="flex justify-between gap-3 py-1"><span className="text-muted-foreground">{k}</span><span className="font-mono">{v}</span></div>
  );

  return (
    <section className="mx-3 mt-4 rounded-2xl bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Location Tracking (Test Mode)</h2>
        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">Private / Admin Only</span>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={checkOnce} disabled={busy} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-60">
          <Crosshair className="h-4 w-4" /> {busy ? "Locating…" : "Check Current GPS"}
        </button>
        <button type="button" onClick={toggleWatch} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-semibold ${watching ? "border-destructive text-destructive" : "border-primary text-primary"}`}>
          <Radio className="h-4 w-4" /> {watching ? "Stop Live Tracking" : "Start Live Tracking"}
        </button>
      </div>
      {error && <p className="mt-3 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{error}</p>}
      {fix && (
        <div className="mt-3 divide-y divide-border text-xs">
          {row("Latitude", fix.lat.toFixed(6))}
          {row("Longitude", fix.lng.toFixed(6))}
          {row("Accuracy", `± ${Math.round(fix.acc * 3.28084)} ft (${Math.round(fix.acc)} m)`)}
          {row("Altitude", fix.alt == null ? "—" : `${Math.round(fix.alt * 3.28084)} ft`)}
          {row("Heading", fix.heading == null || Number.isNaN(fix.heading) ? "—" : `${Math.round(fix.heading)}°`)}
          {row("Speed", fix.speed == null ? "—" : `${(fix.speed * 2.23694).toFixed(1)} mph`)}
          {row("Last ping", `${new Date(fix.at).toLocaleTimeString()} (${Math.max(0, Math.round((now - fix.at) / 1000))}s ago)`)}
        </div>
      )}
    </section>
  );
}

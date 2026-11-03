export const GPS_TARGET_FEET = 20;
export const GPS_FRESH_MS = 10_000;
export const GPS_REFINE_MS = 2_000;
export const GPS_WATCH_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 };
export const GPS_POLISH_MS = 15_000;

export type GpsFix = { latitude: number; longitude: number; accuracyFeet: number; timestamp: number; speed?: number | null };
/** Conservative correction only: never chase a moving phone across the lot. */
export function canPolishGpsFix(saved: GpsFix, next: GpsFix, now: number) {
  const radians = Math.PI / 180;
  const north = (next.latitude - saved.latitude) * radians;
  const east = (next.longitude - saved.longitude) * radians * Math.cos(saved.latitude * radians);
  const distanceFeet = Math.hypot(north, east) * 6_371_000 * 3.28084;
  return isFreshGpsFix(next, now) && next.timestamp > saved.timestamp
    && next.accuracyFeet < saved.accuracyFeet
    && (next.accuracyFeet <= GPS_TARGET_FEET || saved.accuracyFeet - next.accuracyFeet >= 5)
    && (next.speed == null || next.speed <= 0.5) && distanceFeet <= GPS_TARGET_FEET;
}
export function isFreshGpsFix(fix: GpsFix, now: number) {
  return fix.timestamp <= now && now - fix.timestamp < GPS_FRESH_MS;
}
export function isReadyGpsFix(fix: GpsFix | null, now: number) {
  return !!fix && isFreshGpsFix(fix, now) && fix.accuracyFeet < GPS_TARGET_FEET;
}

type Clock = {
  now: () => number;
  setTimeout: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => void;
};
const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (timer) => clearTimeout(timer),
};

/** Device-local only. No storage, network, or application-data dependencies. */
export class GpsPinTracker {
  private watchId: number | null = null;
  private generation = 0;
  private fixes: GpsFix[] = [];
  private listeners = new Set<(fix: GpsFix) => void>();
  private cancellations = new Set<() => void>();
  private pending: { resolve: (fix: GpsFix) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  constructor(private geo: Pick<Geolocation, "watchPosition" | "clearWatch">, private changed: (fix: GpsFix | null, error: string | null) => void, private clock: Clock = realClock) {}

  best(): GpsFix | null {
    this.fixes = this.fixes.filter((fix) => isFreshGpsFix(fix, this.clock.now()));
    return this.fixes.reduce<GpsFix | null>((best, fix) => !best || fix.accuracyFeet < best.accuracyFeet || (fix.accuracyFeet === best.accuracyFeet && fix.timestamp > best.timestamp) ? fix : best, null);
  }
  /** Inverse-variance (1/accuracy²) centroid of recent fresh, nearby readings. */
  averaged(): GpsFix | null {
    const best = this.best();
    if (!best) return null;
    const now = this.clock.now();
    const pool = this.fixes.filter((f) => now - f.timestamp <= 8_000 && (f.speed == null || f.speed <= 0.5) && f.accuracyFeet <= Math.max(best.accuracyFeet * 2, GPS_TARGET_FEET));
    if (pool.length < 2) return best;
    let w = 0, lat = 0, lng = 0;
    for (const f of pool) { const k = 1 / Math.max(f.accuracyFeet, 1) ** 2; w += k; lat += f.latitude * k; lng += f.longitude * k; }
    const accuracyFeet = Math.max(1, Math.min(best.accuracyFeet, 1 / Math.sqrt(w)));
    return { latitude: lat / w, longitude: lng / w, accuracyFeet, timestamp: best.timestamp, speed: best.speed };
  }
  start() {
    if (this.watchId !== null) return;
    const generation = ++this.generation;
    this.watchId = this.geo.watchPosition((position) => {
      if (generation !== this.generation) return;
      const fix: GpsFix = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyFeet: position.coords.accuracy * 3.28084, timestamp: position.timestamp, speed: position.coords.speed };
      if (![fix.latitude, fix.longitude, fix.accuracyFeet, fix.timestamp].every(Number.isFinite) || fix.accuracyFeet < 0 || !isFreshGpsFix(fix, this.clock.now())) return;
      this.fixes.push(fix);
      const best = this.best();
      this.changed(best, null);
      if (best) this.finish(best);
      for (const listener of this.listeners) listener(fix);
    }, (error) => {
      if (generation !== this.generation) return;
      const message = error.code === 1 ? "Location permission denied. Allow location access in your browser settings." : "GPS unavailable. Try again outside.";
      this.changed(this.best(), message);
      if (error.code === 1) {
        this.finish(null, new Error(message));
        this.stop();
      }
    }, GPS_WATCH_OPTIONS);
  }
  acquire(): Promise<GpsFix> {
    if (this.pending) return Promise.reject(new Error("GPS acquisition already in progress."));
    this.start();
    const best = this.averaged();
    if (best) return Promise.resolve(best);
    return new Promise((resolve, reject) => {
      const timer = this.clock.setTimeout(() => this.finish(this.best(), new Error("No fresh GPS reading yet. GPS is still acquiring; try again shortly.")), GPS_REFINE_MS);
      this.pending = { resolve, reject, timer };
    });
  }
  /** Reuse the foreground watch, with at most one correction and no polling writes. */
  polish(saved: GpsFix, corrected: (fix: GpsFix) => void) {
    if (saved.accuracyFeet <= GPS_TARGET_FEET || this.watchId === null) return () => {};
    const deadline = saved.timestamp + GPS_POLISH_MS;
    if (this.clock.now() >= deadline) return () => {};
    const cancel = () => {
      this.clock.clearTimeout(timer);
      this.listeners.delete(listener);
      this.cancellations.delete(cancel);
    };
    const listener = (fix: GpsFix) => {
      if (this.clock.now() >= deadline) return cancel();
      if (!canPolishGpsFix(saved, fix, this.clock.now())) return;
      cancel();
      corrected(fix);
    };
    const timer = this.clock.setTimeout(cancel, deadline - this.clock.now());
    this.listeners.add(listener);
    this.cancellations.add(cancel);
    return cancel;
  }
  private finish(fix: GpsFix | null, error?: Error) {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    this.clock.clearTimeout(pending.timer);
    if (fix) pending.resolve(this.averaged() ?? fix);
    else pending.reject(error ?? new Error("GPS acquisition stopped."));
  }
  stop() {
    for (const cancel of this.cancellations) cancel();
    ++this.generation;
    if (this.watchId !== null) this.geo.clearWatch(this.watchId);
    this.watchId = null;
    this.fixes = [];
    this.finish(null, new Error("GPS acquisition stopped."));
  }
}
export const GPS_TARGET_FEET = 20;
export const GPS_FRESH_MS = 10_000;
export const GPS_REFINE_MS = 2_000;
export const GPS_WATCH_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 };

export type GpsFix = { latitude: number; longitude: number; accuracyFeet: number; timestamp: number };
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
  private pending: { resolve: (fix: GpsFix) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  constructor(private geo: Pick<Geolocation, "watchPosition" | "clearWatch">, private changed: (fix: GpsFix | null, error: string | null) => void, private clock: Clock = realClock) {}

  best(): GpsFix | null {
    this.fixes = this.fixes.filter((fix) => isFreshGpsFix(fix, this.clock.now()));
    return this.fixes.reduce<GpsFix | null>((best, fix) => !best || fix.accuracyFeet < best.accuracyFeet || (fix.accuracyFeet === best.accuracyFeet && fix.timestamp > best.timestamp) ? fix : best, null);
  }
  start() {
    if (this.watchId !== null) return;
    const generation = ++this.generation;
    this.watchId = this.geo.watchPosition((position) => {
      if (generation !== this.generation) return;
      const fix: GpsFix = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyFeet: position.coords.accuracy * 3.28084, timestamp: position.timestamp };
      if (![fix.latitude, fix.longitude, fix.accuracyFeet, fix.timestamp].every(Number.isFinite) || fix.accuracyFeet < 0 || !isFreshGpsFix(fix, this.clock.now())) return;
      this.fixes.push(fix);
      const best = this.best();
      this.changed(best, null);
      if (best) this.finish(best);
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
    const best = this.best();
    if (best) return Promise.resolve(best);
    return new Promise((resolve, reject) => {
      const timer = this.clock.setTimeout(() => this.finish(this.best(), new Error("No fresh GPS reading yet. GPS is still acquiring; try again shortly.")), GPS_REFINE_MS);
      this.pending = { resolve, reject, timer };
    });
  }
  private finish(fix: GpsFix | null, error?: Error) {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    this.clock.clearTimeout(pending.timer);
    if (fix) pending.resolve(fix);
    else pending.reject(error ?? new Error("GPS acquisition stopped."));
  }
  stop() {
    ++this.generation;
    if (this.watchId !== null) this.geo.clearWatch(this.watchId);
    this.watchId = null;
    this.fixes = [];
    this.finish(null, new Error("GPS acquisition stopped."));
  }
}
import { expect, test } from "bun:test";
import { GpsPinTracker, GPS_WATCH_OPTIONS, isReadyGpsFix, type GpsFix } from "./gps-pin";

function setup() {
  let now = 50_000;
  let success: PositionCallback = () => {};
  let failure: PositionErrorCallback = () => {};
  let watchCount = 0;
  const cleared: number[] = [];
  const timers = new Map<ReturnType<typeof setTimeout>, { at: number; run: () => void }>();
  let serial = 0;
  const changed: (GpsFix | null)[] = [];
  const tracker = new GpsPinTracker({
    watchPosition: (ok, error, options) => {
      expect(options).toEqual({ enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 });
      success = ok; failure = error ?? (() => {}); return ++watchCount;
    },
    clearWatch: (id) => { cleared.push(id); },
  }, (fix) => { changed.push(fix); }, {
    now: () => now,
    setTimeout: (run, ms) => {
      const id = ++serial as unknown as ReturnType<typeof setTimeout>;
      timers.set(id, { at: now + ms, run }); return id;
    },
    clearTimeout: (id) => { timers.delete(id); },
  });
  const emit = (feet: number, timestamp = now, latitude = 34) => success({ coords: { latitude, longitude: -117, accuracy: feet / 3.28084 }, timestamp } as GeolocationPosition);
  const advance = (ms: number) => {
    now += ms;
    for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.run(); }
  };
  return { tracker, emit, advance, cleared, timers, changed, denied: () => failure({ code: 1 } as GeolocationPositionError) };
}

test("GPS precision must be strictly under 20 feet", () => {
  const fix = { latitude: 34, longitude: -117, timestamp: 50_000, accuracyFeet: 20 };
  expect(isReadyGpsFix(fix, 50_000)).toBe(false);
  expect(isReadyGpsFix({ ...fix, accuracyFeet: 19.9 }, 50_000)).toBe(true);
});
test("GPS freshness is strictly less than 10 seconds", () => {
  const fix = { latitude: 34, longitude: -117, timestamp: 40_000, accuracyFeet: 14 };
  expect(isReadyGpsFix(fix, 50_000)).toBe(false);
  expect(isReadyGpsFix({ ...fix, timestamp: 40_001 }, 50_000)).toBe(true);
});
test("warm accurate fix returns immediately without refinement timer", async () => {
  const s = setup(); s.tracker.start(); s.emit(14);
  const result = await s.tracker.acquire();
  expect(result).toMatchObject({ latitude: 34, longitude: -117, timestamp: 50_000 });
  expect(result.accuracyFeet).toBeCloseTo(14);
  expect(s.timers.size).toBe(0); s.tracker.stop();
});
test("coarse fix refines immediately on an under-20-foot update", async () => {
  const s = setup(); s.tracker.start(); s.emit(190);
  const result = s.tracker.acquire();
  s.advance(1_500); s.emit(15, 51_500, 35);
  expect((await result).latitude).toBe(35);
  expect(s.timers.size).toBe(0); s.tracker.stop();
});
test("fallback waits at most 2000ms and returns best fresh fix, not latest coarse fix", async () => {
  const s = setup(); s.tracker.start(); s.emit(190);
  let resolved = false;
  const result = s.tracker.acquire().then((fix) => { resolved = true; return fix; });
  s.advance(1_000); s.emit(40, 51_000, 35); s.emit(80, 51_000, 36);
  s.advance(999); await Promise.resolve(); expect(resolved).toBe(false);
  s.advance(1);
  expect((await result).latitude).toBe(35);
  expect((await result).accuracyFeet).toBeCloseTo(40); s.tracker.stop();
});
test("no fresh reading fails at 2000ms instead of saving stale or invented coordinates", async () => {
  const s = setup(); s.tracker.start(); s.emit(14, 40_000);
  const result = s.tracker.acquire();
  const assertion = expect(result).rejects.toThrow("No fresh GPS reading");
  s.advance(2_000); await assertion; s.tracker.stop();
});
test("expired precise fix cannot beat a new coarse fix", async () => {
  const s = setup(); s.tracker.start(); s.emit(14);
  s.advance(10_000); s.emit(70, 60_000, 35);
  const result = s.tracker.acquire(); s.advance(2_000);
  expect((await result).latitude).toBe(35); s.tracker.stop();
});
test("successful-save cleanup clears watch and ignores late callbacks", () => {
  const s = setup(); s.tracker.start(); s.emit(14); s.tracker.stop();
  const count = s.changed.length; s.emit(10);
  expect(s.cleared).toEqual([1]); expect(s.changed).toHaveLength(count);
  expect(s.tracker.best()).toBeNull();
});
test("unmount cancels pending refinement and all timers", async () => {
  const s = setup(); const result = s.tracker.acquire();
  const assertion = expect(result).rejects.toThrow("GPS acquisition stopped");
  s.tracker.stop(); await assertion;
  expect(s.cleared).toEqual([1]); expect(s.timers.size).toBe(0);
});
test("permission denial rejects without coordinates and stops tracking", async () => {
  const s = setup(); const result = s.tracker.acquire();
  const assertion = expect(result).rejects.toThrow("Location permission denied");
  s.denied(); await assertion;
  expect(s.cleared).toEqual([1]); expect(s.timers.size).toBe(0);
  expect(GPS_WATCH_OPTIONS.maximumAge).toBe(0);
});
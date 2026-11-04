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
      expect(options).toEqual({ enableHighAccuracy: true, timeout: 10_000, maximumAge: 3_000 });
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
  const emit = (feet: number, timestamp = now, latitude = 34, speed: number | null = null) => success({ coords: { latitude, longitude: -117, accuracy: feet / 3.28084, speed }, timestamp } as GeolocationPosition);
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
test("GPS freshness is strictly less than 25 seconds", () => {
  const fix = { latitude: 34, longitude: -117, timestamp: 25_000, accuracyFeet: 14 };
  expect(isReadyGpsFix(fix, 50_000)).toBe(false);
  expect(isReadyGpsFix({ ...fix, timestamp: 25_001 }, 50_000)).toBe(true);
});
test("warm accurate fix returns immediately without refinement timer", async () => {
  const s = setup(); s.tracker.start(); s.emit(14);
  const result = await s.tracker.acquire();
  expect(result).toMatchObject({ latitude: 34, longitude: -117, timestamp: 50_000 });
  expect(result.accuracyFeet).toBeCloseTo(14);
  expect(s.timers.size).toBe(0); s.tracker.stop();
});
test("fresh 36-foot fix returns immediately with no accuracy hold", async () => {
  const s = setup(); s.tracker.start(); s.emit(36);
  let resolved = false;
  const result = s.tracker.acquire().then((fix) => { resolved = true; return fix; });
  expect((await result).accuracyFeet).toBeCloseTo(36);
  expect(resolved).toBe(true);
  expect(s.timers.size).toBe(0); s.tracker.stop();
});
test("instant capture weights nearby fresh readings toward the most accurate one", async () => {
  const s = setup(); s.tracker.start(); s.emit(36);
  s.advance(1_000); s.emit(30, 51_000, 35); s.emit(70, 51_000, 36);
  const result = s.tracker.acquire();
  expect((await result).accuracyFeet).toBeCloseTo(30);
  expect(s.timers.size).toBe(0);
  { const lat = (await result).latitude; expect(lat).toBeGreaterThan(34); expect(lat).toBeLessThan(35); } s.tracker.stop();
});
test("cold capture resolves on first fresh fix without waiting for accuracy", async () => {
  const s = setup(); s.tracker.start();
  let resolved = false;
  const result = s.tracker.acquire().then((fix) => { resolved = true; return fix; });
  s.advance(1_000); s.emit(40, 51_000, 35); s.emit(80, 51_000, 36);
  await Promise.resolve(); expect(resolved).toBe(true);
  expect(s.timers.size).toBe(0);
  expect((await result).latitude).toBe(35);
  expect((await result).accuracyFeet).toBeCloseTo(40); s.tracker.stop();
});
test("no fresh reading fails at 2000ms instead of saving stale or invented coordinates", async () => {
  const s = setup(); s.tracker.start(); s.emit(14, 25_000);
  const result = s.tracker.acquire();
  const failure = result.catch((error: Error) => error.message);
  s.advance(2_000); expect(await failure).toContain("No fresh GPS reading"); s.tracker.stop();
});
test("expired precise fix cannot beat a new coarse fix", async () => {
  const s = setup(); s.tracker.start(); s.emit(14);
  s.advance(25_000); s.emit(70, 75_000, 35);
  const result = s.tracker.acquire(); s.advance(2_000);
  expect((await result).latitude).toBe(35); s.tracker.stop();
});
test("default timer helpers do not invoke browser timers with tracker clock as receiver", async () => {
  const originalSet = globalThis.setTimeout;
  const originalClear = globalThis.clearTimeout;
  let callback: (() => void) | undefined;
  let clearCalled = false;
  const timer = 1 as unknown as ReturnType<typeof setTimeout>;
  try {
    globalThis.setTimeout = function (this: unknown, cb: () => void) {
      if (this !== undefined && this !== globalThis) throw new TypeError("Invalid timer receiver");
      callback = cb; return timer;
    } as typeof setTimeout;
    globalThis.clearTimeout = function (this: unknown) {
      if (this !== undefined && this !== globalThis) throw new TypeError("Invalid timer receiver");
      clearCalled = true;
    } as typeof clearTimeout;
    const tracker = new GpsPinTracker({ watchPosition: () => 1, clearWatch: () => {} }, () => {});
    const failure = tracker.acquire().catch((error: Error) => error.message);
    callback?.();
    expect(await failure).toContain("No fresh GPS reading");
    expect(clearCalled).toBe(true);
    tracker.stop();
  } finally {
    globalThis.setTimeout = originalSet;
    globalThis.clearTimeout = originalClear;
  }
});
test("stopping clears watch and ignores late callbacks", () => {
  const s = setup(); s.tracker.start(); s.emit(14); s.tracker.stop();
  const count = s.changed.length; s.emit(10);
  expect(s.cleared).toEqual([1]); expect(s.changed).toHaveLength(count);
  expect(s.tracker.best()).toBeNull();
});
test("unmount cancels pending refinement and all timers", async () => {
  const s = setup(); const result = s.tracker.acquire();
  const failure = result.catch((error: Error) => error.message);
  s.tracker.stop(); expect(await failure).toContain("GPS acquisition stopped");
  expect(s.cleared).toEqual([1]); expect(s.timers.size).toBe(0);
});
test("permission denial rejects without coordinates and stops tracking", async () => {
  const s = setup(); const result = s.tracker.acquire();
  const failure = result.catch((error: Error) => error.message);
  s.denied(); expect(await failure).toContain("Location permission denied");
  expect(s.cleared).toEqual([1]); expect(s.timers.size).toBe(0);
  expect(GPS_WATCH_OPTIONS.maximumAge).toBe(3_000);
});

test("26-foot drop gets one later sub-20-foot correction without holding capture", async () => {
  const s = setup(); s.tracker.start(); s.emit(26);
  const saved = await s.tracker.acquire();
  const corrections: GpsFix[] = [];
  s.tracker.polish(saved, (fix) => corrections.push(fix));
  s.advance(1_000); s.emit(19);
  s.advance(1_000); s.emit(7);
  expect(corrections).toHaveLength(1);
  expect(corrections[0]?.accuracyFeet).toBeCloseTo(19);
  expect(s.timers.size).toBe(0); s.tracker.stop();
});
test("coarse polish accepts an improvement of at least five feet", async () => {
  const s = setup(); s.tracker.start(); s.emit(36);
  const corrections: GpsFix[] = [];
  s.tracker.polish(await s.tracker.acquire(), (fix) => corrections.push(fix));
  s.advance(1_000); s.emit(32);
  expect(corrections).toHaveLength(0);
  s.advance(1_000); s.emit(30);
  expect(corrections[0]?.accuracyFeet).toBeCloseTo(30); s.tracker.stop();
});
test("polish expires at fifteen seconds and never writes after stop or cancellation", async () => {
  const s = setup(); s.tracker.start(); s.emit(26);
  let count = 0;
  const saved = await s.tracker.acquire();
  s.tracker.polish(saved, () => count++);
  s.advance(15_000); s.emit(7);
  expect(count).toBe(0);
  s.emit(26); const cancel = s.tracker.polish(await s.tracker.acquire(), () => count++);
  cancel(); s.advance(1_000); s.emit(7);
  expect(count).toBe(0);
  s.emit(26); s.advance(10_000); s.emit(26);
  s.tracker.polish(await s.tracker.acquire(), () => count++);
  s.tracker.stop(); s.emit(7);
  expect(count).toBe(0); expect(s.timers.size).toBe(0);
});
test("polish cannot follow a walking employee or a distant tighter fix", async () => {
  const s = setup(); s.tracker.start(); s.emit(26);
  const corrections: GpsFix[] = [];
  s.tracker.polish(await s.tracker.acquire(), (fix) => corrections.push(fix));
  s.advance(1_000); s.emit(7, 51_000, 34, 1.2);
  s.advance(1_000); s.emit(7, 52_000, 34.001);
  expect(corrections).toHaveLength(0); s.tracker.stop();
});
import { normalizeSpot, locationChoice, isCustomSpot } from "./lot";
test("GPS pin location is its own choice, never a custom Other location", () => {
  expect(normalizeSpot("GPS PIN")).toBe("GPS");
  expect(locationChoice("GPS")).toBe("GPS");
  expect(isCustomSpot("GPS")).toBe(false);
});

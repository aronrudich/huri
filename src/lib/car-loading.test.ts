import { expect, test } from "bun:test";
import { loadAllCarPages, isActiveCar, mergeLoadedCarDetails } from "./car-loading";

test("active inventory over 1000 returns all 2389 cars", async () => {
  const cars = Array.from({ length: 2389 }, (_, id) => ({ id }));
  const ranges: number[][] = [];
  const loaded = await loadAllCarPages((from, to) => {
    ranges.push([from, to]);
    return Promise.resolve({ data: cars.slice(from, to + 1), error: null });
  });
  expect(loaded).toEqual(cars);
  expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
});

test("exactly 1000 cars checks the next page", async () => {
  let calls = 0;
  const loaded = await loadAllCarPages((from) => {
    calls++;
    return Promise.resolve({ data: from === 0 ? Array.from({ length: 1000 }, (_, id) => id) : [], error: null });
  });
  expect(loaded.length).toBe(1000);
  expect(calls).toBe(2);
});

test("a failed later page rejects rather than returning an incomplete lot", async () => {
  const error = new Error("offline");
  expect(loadAllCarPages((from) => Promise.resolve({
    data: from === 0 ? Array(1000).fill(1) : null, error: from === 0 ? null : error,
  }))).rejects.toThrow("offline");
});

test("TAKEN cars leave active inventory but BAY and UNKNOWN stay tracked", () => {
  expect(isActiveCar({ lot_position: "TAKEN" })).toBe(false);
  for (const lot_position of ["SV 3", "BAY", "UNKNOWN", "CP", "BL"]) expect(isActiveCar({ lot_position })).toBe(true);
});

test("RO lookup loads Jeep GC and notes without replacing selected SV 3", () => {
  expect(mergeLoadedCarDetails({ model: "", notes: "", pos: "SV 3" },
    { car_model: "Jeep GC", notes: "Key inside", lot_position: "SV 84" },
    { model: false, notes: false, pos: true })).toEqual({ model: "Jeep GC", notes: "Key inside", pos: "SV 3" });
});

test("late RO lookup never overwrites typed details or explicitly cleared notes", () => {
  expect(mergeLoadedCarDetails({ model: "Wrangler", notes: "", pos: "CP" },
    { car_model: "Jeep GC", notes: "Old notes", lot_position: "SV 84" },
    { model: true, notes: true, pos: true })).toEqual({ model: "Wrangler", notes: "", pos: "CP" });
});
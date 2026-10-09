import { describe, expect, test } from "bun:test";
import { isPickupMapRequest } from "./lot";

describe("map request highlighting", () => {
  test("only a non-staged pickup is blue", () => {
    expect(isPickupMapRequest("pickup", false)).toBe(true);
  });

  test("park requests are never blue", () => {
    expect(isPickupMapRequest("park", false)).toBe(false);
  });

  test("staged pickups keep their staged treatment instead of blue", () => {
    expect(isPickupMapRequest("pickup", true)).toBe(false);
  });
});
import { expect, test } from "bun:test";
import { claimHideMilliseconds, isClaimWithinWindow } from "./pickup-window";

test("claimed pickups remain through 59:59 and leave at 60 minutes, not 20", () => {
  const claimedAt = "2026-10-20T00:00:00Z";
  const start = Date.parse(claimedAt);
  const duration = claimHideMilliseconds();
  expect(duration).toBe(3_600_000);
  expect(isClaimWithinWindow(claimedAt, start + 20 * 60_000, duration)).toBe(true);
  expect(isClaimWithinWindow(claimedAt, start + 3_599_999, duration)).toBe(true);
  expect(isClaimWithinWindow(claimedAt, start + 3_600_000, duration)).toBe(false);
});

test("other companies keep their configured claim window", () => {
  expect(claimHideMilliseconds(90)).toBe(5_400_000);
});
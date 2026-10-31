import { expect, test } from "bun:test";
import { carTipKey, shouldShowCarTip } from "./car-shortcut";
import { playVideoFullscreen } from "./video-fullscreen";

test("car guide excludes advisors, spectators, anonymous and dismissed users", () => {
  expect(shouldShowCarTip("Advisor", "a")).toBe(false);
  expect(shouldShowCarTip("Spectator", "a")).toBe(false);
  expect(shouldShowCarTip("Valet")).toBe(false);
  expect(shouldShowCarTip("Valet", "a", true)).toBe(false);
  expect(shouldShowCarTip("Valet", "a")).toBe(true);
});
test("car guide dismissal is distinct for each user", () => {
  expect(carTipKey("a")).toBe("huri_car_button_tip_dismissed:a");
  expect(carTipKey("a")).not.toBe(carTipKey("b"));
});
test("video starts playback and requests native fullscreen on the same tap", async () => {
  const calls: string[] = [];
  await playVideoFullscreen({ play: async () => { calls.push("play"); }, requestFullscreen: async () => { calls.push("fullscreen"); } });
  expect(calls).toEqual(["play", "fullscreen"]);
});
test("iOS fullscreen and denied fullscreen retain playback", async () => {
  const calls: string[] = [];
  await playVideoFullscreen({ play: async () => { calls.push("play"); }, webkitEnterFullscreen: () => { calls.push("ios"); } });
  expect(calls).toEqual(["play", "ios"]);
  await expect(playVideoFullscreen({ play: async () => {}, requestFullscreen: async () => { throw new Error("denied"); } })).resolves.toBeUndefined();
});
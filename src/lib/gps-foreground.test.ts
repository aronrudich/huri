import { expect, test } from "bun:test";
import { watchForegroundGps } from "./gps-foreground";

test("visibilitychange pauses immediately when hidden and resumes on return", () => {
  let started = 0, stopped = 0;
  const target = new EventTarget();
  const visibility = Object.assign(target, { hidden: false });
  const active: boolean[] = [];
  const cleanup = watchForegroundGps({ start: () => { started++; }, stop: () => { stopped++; } }, visibility, (value) => active.push(value));
  expect(started).toBe(1);
  visibility.hidden = true;
  target.dispatchEvent(new Event("visibilitychange"));
  expect(stopped).toBe(1);
  expect(active.at(-1)).toBe(false);
  visibility.hidden = false;
  target.dispatchEvent(new Event("visibilitychange"));
  expect(started).toBe(2);
  cleanup();
  target.dispatchEvent(new Event("visibilitychange"));
  expect(started).toBe(2);
  expect(stopped).toBe(2);
});

test("initially hidden app never starts GPS", () => {
  let started = 0;
  const visibility = Object.assign(new EventTarget(), { hidden: true });
  const cleanup = watchForegroundGps({ start: () => { started++; }, stop() {} }, visibility, () => {});
  expect(started).toBe(0);
  cleanup();
});
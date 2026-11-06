import { expect, test } from "bun:test";
import { SATELLITE_ZOOM } from "./satellite-zoom";

test("satellite views use native level 19 imagery", () => {
  expect(SATELLITE_ZOOM.maxNativeZoom).toBe(19);
});

test("satellite views stop digital zoom at level 20", () => {
  expect(SATELLITE_ZOOM.maxZoom).toBe(20);
});
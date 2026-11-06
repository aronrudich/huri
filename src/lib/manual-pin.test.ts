import { expect, test } from "bun:test";
import { lotCenter, manualPinLocation, pinZoneAt, PIN_ZONES } from "./manual-pin";
import { visibleLocation } from "./lot";

test("BMW supplied polygon requires spots 1 through 128", () => {
  const point = lotCenter("BMWR2985");
  if (!point) throw new Error("Missing BMW zone");
  expect(pinZoneAt("BMWR2985", point)?.location).toBe("Service Lot");
  expect(manualPinLocation("BMWR2985", point, "1")).toBe("Service Lot 1");
  expect(manualPinLocation("BMWR2985", point, "128")).toBe("Service Lot 128");
  for (const value of ["", "0", "129", "1.5"]) expect(manualPinLocation("BMWR2985", point, value)).toBeNull();
});
test("JCD supplied perimeter includes center and corners and requires spots 1 through 120", () => {
  const point = lotCenter("JCD29854");
  if (!point) throw new Error("Missing JCD zone");
  expect(pinZoneAt("JCD29854", point)?.location).toBe("SV");
  for (const corner of PIN_ZONES[1].corners) expect(pinZoneAt("JCD29854", corner)?.location).toBe("SV");
  expect(manualPinLocation("JCD29854", point, "1")).toBe("SV 1");
  expect(manualPinLocation("JCD29854", point, "120")).toBe("SV 120");
  for (const value of ["", "0", "121"]) expect(manualPinLocation("JCD29854", point, value)).toBeNull();
});
test("outside zones needs no number and another company's zone never matches", () => {
  const point = { latitude: 34, longitude: -117 };
  expect(pinZoneAt("JCD29854", point)).toBeNull();
  expect(manualPinLocation("BMWR2985", point, "")).toBe("GPS");
  const bmw = lotCenter("BMWR2985");
  if (!bmw) throw new Error("Missing BMW zone");
  expect(pinZoneAt("JCD29854", bmw)).toBeNull();
  expect(pinZoneAt("OTHER", bmw)).toBeNull();
});
test("private location masking leaves stored spots and authorized GPS unchanged", () => {
  expect(visibleLocation("GPS", false)).toBe("Location saved");
  expect(visibleLocation("GPS PIN", false)).toBe("Location saved");
  expect(visibleLocation("GPS", true)).toBe("GPS");
  expect(visibleLocation("SV 120", false)).toBe("SV 120");
});
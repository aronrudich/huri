import { expect, test } from "bun:test";
import { activePickupPins } from "./pickup-pins";

const pin = (id: string, ro_number = id) => ({ id, ro_number, car_model: null, lot_position: "GPS PIN", latitude: 34, longitude: -117, accuracy_ft: 20, pinned_at: null });
test("pickup map excludes unrelated parked cars and finished requests", () => {
  expect(activePickupPins([
    { id: "r1", ro_number: "193626", status: "unclaimed" },
    { id: "r2", ro_number: "193627", status: "claimed" },
    { id: "r3", ro_number: "193628", status: "canceled" },
    { id: "r4", ro_number: "193629", status: "completed" },
  ], [pin("193626"), pin("193627"), pin("193628"), pin("193629"), pin("193630")]).map((car) => car.ro_number)).toEqual(["193626", "193627"]);
});
test("claimed TAKEN cars retain request coordinates and duplicate ROs have one pin", () => {
  expect(activePickupPins([
    { id: "r1", ro_number: "193626", status: "claimed", latitude: 34.5, longitude: -117.5 },
    { id: "r2", ro_number: "193626", status: "unclaimed", latitude: 35, longitude: -118 },
    { id: "r3", ro_number: "193627", status: "unclaimed", latitude: null, longitude: null },
  ], [])).toEqual([{ ...pin("request:r1", "193626"), lot_position: null, latitude: 34.5, longitude: -117.5, accuracy_ft: null }]);
});
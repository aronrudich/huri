import { expect, test } from "bun:test";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { occupiedBlockers, type LocationRule } from "./company-locations";
import { ConfiguredLocationPicker } from "@/components/ConfiguredLocationPicker";
import { PICKUP_NOTIFICATION_ROLES, isApproverRole } from "./roles";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const rules: LocationRule[] = Array.from({ length: 128 }, (_, i) => ({ label: `SERVICE LOT ${i + 1}`, lot_name: "Service Lot", capacity: 1, blockers: [23,24,25,26,27,28,29,49,50,51,52,53,54,55,75,76,77,78,79,80,81].includes(i + 1) ? [`SERVICE LOT ${i - 6}`, `SERVICE LOT ${i + 8}`] : [] }));
for (const area of ["Service Done", "Used Car Service", "W1", "W2", "Charging"]) rules.push({ label: area.toUpperCase(), lot_name: area, capacity: 0, blockers: [] });
test("all 21 BMW middle spots require both corresponding blockers", () => {
  const middle = rules.filter((r) => r.blockers.length);
  expect(middle).toHaveLength(21);
  for (const r of middle) {
    const [a, b] = r.blockers;
    const cars = { [a]: { lot_position: a }, [b]: { lot_position: b } };
    expect(occupiedBlockers(r.label, rules, false, cars)).toEqual([cars[a], cars[b]]);
    expect(occupiedBlockers(r.label, rules, false, { [a]: cars[a] })).toEqual([]);
    expect(occupiedBlockers(r.label, rules, false, { [b]: cars[b] })).toEqual([]);
    expect(occupiedBlockers(r.label, rules, false, {})).toEqual([]);
  }
});
test("JCD retains single occupied tandem blocker behavior", () => {
  expect(occupiedBlockers("SV 3", [], true, { "SV 1": { lot_position: "SV 1" } })).toEqual([{ lot_position: "SV 1" }]);
  expect(occupiedBlockers("SV 3", rules, false, { "SV 1": { lot_position: "SV 1" } })).toEqual([]);
});
test("BMW numbered picker accepts 1–128 only and shared areas save immediately", async () => {
  let screen: ReactTestRenderer | undefined;
  const emitted: string[] = [];
  await act(async () => { screen = create(<ConfiguredLocationPicker value="" rules={rules} onChange={(v) => emitted.push(v)} />); });
  if (!screen) throw new Error("No picker");
  const s = screen;
  await act(async () => s.root.findByType("select").props.onChange({ target: { value: "Service Lot" } }));
  for (const [value, expected] of [["1", "SERVICE LOT 1"], ["128", "SERVICE LOT 128"], ["129", ""], ["0", ""]]) {
    await act(async () => s.root.findByProps({ "aria-label": "Spot number" }).props.onChange({ target: { value } }));
    expect(emitted.at(-1)).toBe(expected);
  }
  for (const [value, expected] of [["Service Done", "SERVICE DONE"], ["Used Car Service", "USED CAR SERVICE"], ["W1", "W1"], ["W2", "W2"], ["Charging", "CHARGING"], ["Technician Bay", "BAY"], ["Unknown", "UNKNOWN"]]) {
    await act(async () => s.root.findByType("select").props.onChange({ target: { value } }));
    expect(emitted.at(-1)).toBe(expected);
  }
  await act(async () => s.root.findByType("select").props.onChange({ target: { value: "Other" } }));
  await act(async () => s.root.findByProps({ "aria-label": "Other location" }).props.onChange({ target: { value: "North entrance" } }));
  expect(emitted.at(-1)).toBe("North entrance");
  await act(async () => s.unmount());
});
test("all requested management roles receive alerts and can approve employees", () => {
  expect(PICKUP_NOTIFICATION_ROLES).toEqual(["Valet", "Valet Supervisor", "Admin", "Service Manager", "Service Director", "General Manager"]);
  for (const role of ["Service Manager", "Service Director", "Admin", "General Manager"]) expect(isApproverRole(role)).toBe(true);
  expect(isApproverRole("Spectator")).toBe(false);
});
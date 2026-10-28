import { expect, test } from "bun:test";
import { DEFAULT_SERVICE_HOURS, isValidRo, parseServiceHours } from "./company-configuration";
import { isServiceTimeOpen } from "./service-hours";
import { currentShiftStart, shiftDayEnd, shiftDayStart } from "./report-range";
import { blockersForLocation } from "./company-locations";

test("JCD hours retain inclusive weekday and Saturday boundaries", () => {
  expect(isServiceTimeOpen("2026-10-28",6,30,"AM")).toBe(true);
  expect(isServiceTimeOpen("2026-10-28",6,0,"PM")).toBe(true);
  expect(isServiceTimeOpen("2026-10-28",6,1,"PM")).toBe(false);
  expect(isServiceTimeOpen("2026-10-31",8,0,"AM")).toBe(true);
  expect(isServiceTimeOpen("2026-11-01",8,0,"AM")).toBe(false);
});
test("company schedule accepts 6:45 PM when closing at 7 PM", () => {
  const hours=DEFAULT_SERVICE_HOURS.map((d)=>d ? {open:420,close:1140}:null);
  expect(isServiceTimeOpen("2026-10-28",6,45,"PM",hours)).toBe(true);
  expect(isServiceTimeOpen("2026-10-28",7,1,"PM",hours)).toBe(false);
  expect(()=>parseServiceHours([{open:800,close:700}])).toThrow();
  expect(()=>parseServiceHours([null,{open:800,close:700},null,null,null,null,null])).toThrow();
  expect(()=>parseServiceHours([null,{open:-1,close:700},null,null,null,null,null])).toThrow();
});
test("RO settings retain six digits and permit requested flexible formats", () => {
  expect(isValidRo("45120")).toBe(false);
  expect(isValidRo("194000")).toBe(true);
  for(const ro of ["45120","B-1042","9850","ABC_123"]) expect(isValidRo(ro,"flexible")).toBe(true);
  expect(isValidRo("../../x","flexible")).toBe(false);
});
test("Central reporting boundaries use local clock including DST", () => {
  expect(shiftDayStart("2026-10-28","America/Chicago").toISOString()).toBe("2026-10-28T11:30:00.000Z");
  expect(shiftDayEnd("2026-10-31","America/Chicago").getTime()-shiftDayStart("2026-10-31","America/Chicago").getTime()).toBe(25*3600000);
  expect(currentShiftStart(new Date("2026-11-01T11:00:00Z"),"America/Chicago").toISOString()).toBe("2026-10-31T11:30:00.000Z");
});
test("blocking rules are configured per company, never inferred for another store",()=>{
  expect(blockersForLocation("MAIN 3",[{label:"MAIN 3",lot_name:"Main",capacity:1,blockers:["MAIN 1","MAIN 2"]}],false)).toEqual(["MAIN 1","MAIN 2"]);
  expect(blockersForLocation("SV 3",[],false)).toEqual([]);
  expect(blockersForLocation("SV 3",[],true)).toEqual(["SV 2","SV 1"]);
});
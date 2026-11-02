import { expect, test } from "bun:test";
import { DEFAULT_SERVICE_HOURS, filterRoInput, isValidRo, parseServiceHours, roDigitLength } from "./company-configuration";
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
test("RO formats are strictly numeric, 1 to 7 digits, defaulting to 6", () => {
  expect(isValidRo("45120")).toBe(false);
  expect(isValidRo("194000")).toBe(true);
  expect(isValidRo("194000", "digits_6")).toBe(true);
  expect(isValidRo("7", "digits_1")).toBe(true);
  expect(isValidRo("42", "digits_2")).toBe(true);
  expect(isValidRo("1234567", "digits_7")).toBe(true);
  expect(isValidRo("123456", "digits_7")).toBe(false);
  expect(isValidRo("1234567", "digits_6")).toBe(false);
  expect(isValidRo("B-1042", "digits_4")).toBe(false);
  // Legacy and unknown formats fall back to the 6-digit standard.
  expect(isValidRo("194000", "six_digits")).toBe(true);
  expect(isValidRo("194000", "flexible")).toBe(true);
  expect(isValidRo("45120", "flexible")).toBe(false);
});
test("RO digit length and input filter follow the configured format", () => {
  expect(roDigitLength(undefined)).toBe(6);
  expect(roDigitLength("digits_1")).toBe(1);
  expect(roDigitLength("digits_7")).toBe(7);
  expect(roDigitLength("flexible")).toBe(6);
  expect(filterRoInput("12a3-456", "digits_4")).toBe("1234");
  expect(filterRoInput("12345678", "digits_7")).toBe("1234567");
  expect(filterRoInput("abc", "digits_3")).toBe("");
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
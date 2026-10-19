import { describe, expect, test } from "bun:test";
import { isServiceTimeOpen, isServiceOpenAt, requireServiceOpenAt } from "./service-hours";

describe("customer arrival service hours", () => {
  test("Monday–Friday accept 6:30 AM through 6:00 PM only", () => {
    for (const date of ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]) {
      expect(isServiceTimeOpen(date, 6, 29, "AM")).toBe(false);
      expect(isServiceTimeOpen(date, 6, 30, "AM")).toBe(true);
      expect(isServiceTimeOpen(date, 6, 0, "PM")).toBe(true);
      expect(isServiceTimeOpen(date, 6, 1, "PM")).toBe(false);
    }
  });
  test("Saturday accepts 8 AM through 4 PM and rejects 4:30 PM", () => {
    expect(isServiceTimeOpen("2026-10-24", 7, 59, "AM")).toBe(false);
    expect(isServiceTimeOpen("2026-10-24", 8, 0, "AM")).toBe(true);
    expect(isServiceTimeOpen("2026-10-24", 4, 0, "PM")).toBe(true);
    expect(isServiceTimeOpen("2026-10-24", 4, 1, "PM")).toBe(false);
    expect(isServiceTimeOpen("2026-10-24", 4, 30, "PM")).toBe(false);
  });
  test("Sunday is closed all day", () => {
    for (let minute = 0; minute < 1440; minute++) {
      expect(isServiceTimeOpen("2026-10-25", Math.floor(minute / 60) % 12 || 12, minute % 60, minute < 720 ? "AM" : "PM")).toBe(false);
    }
  });
  test("live arrived-now validation uses the company's date, not UTC", () => {
    const at = new Date("2026-10-25T00:30:00Z"); // Saturday 5:30 PM in California, Sunday UTC
    expect(isServiceOpenAt("America/Los_Angeles", at)).toBe(false);
    expect(() => requireServiceOpenAt("America/Los_Angeles", at)).toThrow();
    expect(() => requireServiceOpenAt("America/Los_Angeles", new Date("2026-10-24T23:00:00Z"))).not.toThrow();
  });
  test("company timezone and daylight-saving changes preserve wall-clock boundaries", () => {
    expect(isServiceOpenAt("America/Los_Angeles", new Date("2026-10-19T13:30:00Z"))).toBe(true);
    expect(isServiceOpenAt("America/Los_Angeles", new Date("2026-11-02T14:29:00Z"))).toBe(false);
    expect(isServiceOpenAt("America/Los_Angeles", new Date("2026-11-02T14:30:00Z"))).toBe(true);
    expect(isServiceOpenAt("America/New_York", new Date("2026-10-19T10:30:00Z"))).toBe(true);
  });
  test("invalid calendar dates fail closed", () => {
    expect(isServiceTimeOpen("2026-02-30", 10, 0, "AM")).toBe(false);
  });
});
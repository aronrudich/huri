import { expect, test } from "bun:test";
import { isReportEligible, MAX_REPORT_CLAIM_MS } from "./report-eligibility";

const created_at = "2026-10-21T06:00:00.000Z";
const claim = (ms) => ({
  status: "completed",
  created_at,
  claimed_at: new Date(Date.parse(created_at) + ms).toISOString(),
});

test("claims exactly eight hours and shorter remain reportable", () => {
  expect(MAX_REPORT_CLAIM_MS).toBe(28_800_000);
  expect(isReportEligible(claim(28_799_999))).toBe(true);
  expect(isReportEligible(claim(28_800_000))).toBe(true);
});

test("claims strictly over eight hours contribute no report activity", () => {
  expect(isReportEligible(claim(28_800_001))).toBe(false);
  expect(isReportEligible(claim(32_400_000))).toBe(false);
});

test("report filtering keeps underlying operational records intact", () => {
  const rows = [claim(28_800_000), claim(28_800_001)];
  const original = structuredClone(rows);
  expect(rows.filter(isReportEligible)).toEqual([rows[0]]);
  expect(rows).toEqual(original);
  expect(rows).toHaveLength(2);
});

test("unclaimed requests remain eligible until a claim exceeds the cutoff", () => {
  expect(isReportEligible({ status: "unclaimed", created_at, claimed_at: null })).toBe(true);
});

test("canceled and bookkeeping requests stay excluded", () => {
  for (const status of ["canceled", "cancelled", "picked_up"]) {
    expect(isReportEligible({ ...claim(1000), status })).toBe(false);
  }
});
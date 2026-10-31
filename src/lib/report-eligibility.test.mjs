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

test("Val's restored completed job regains report eligibility without changing its times", () => {
  const canceled = { status: "canceled", created_at: "2026-09-14T21:39:22.925Z", claimed_at: "2026-09-14T21:40:00.000Z", completed_at: "2026-09-14T21:41:39.842Z" };
  const restored = { ...canceled, status: "completed" };
  expect(isReportEligible(canceled)).toBe(false);
  expect(isReportEligible(restored)).toBe(true);
  expect(restored.created_at).toBe(canceled.created_at);
  expect(restored.claimed_at).toBe(canceled.claimed_at);
  expect(restored.completed_at).toBe(canceled.completed_at);
});
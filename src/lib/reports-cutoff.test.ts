/// <reference types="bun" />
import { expect, mock, test } from "bun:test";

// Exercise the real aggregation handler without making network calls or writes.
mock.module("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (fn: unknown) => fn,
    };
    return builder;
  },
}));
mock.module("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

const { getReport } = await import("./reports.functions");
const created_at = "2026-10-21T06:00:00.000Z";
const request = (id: string, ms: number | null, employee = "eligible") => ({
  id, created_at,
  claimed_at: ms === null ? null : new Date(Date.parse(created_at) + ms).toISOString(),
  claimed_by: ms === null ? null : employee,
  requested_by: employee, kind: "park", is_staged: false,
  source_role: "Technician", status: ms === null ? "unclaimed" : "completed",
  completed_at: "2026-10-21T16:00:00.000Z", lot_position: "UNKNOWN",
  ro_number: null, dealership_id: "company",
});

const requests = [request("boundary", 28_800_000), request("short", 1000),
  { ...request("excluded", 28_800_001, "excluded"), ro_number: "193578" },
  request("waiting", null)];
const original = structuredClone(requests);

function query(data: unknown) {
  const result = { data, error: null };
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "lt", "in", "not", "order", "range", "limit"]) {
    builder[method] = () => builder;
  }
  builder.maybeSingle = () => Promise.resolve({ data: {
    role_name: "Admin", is_owner: true, is_active: true, status: "approved", dealership_id: "company",
  } });
  builder.single = () => Promise.resolve({ data: { timezone: "America/Los_Angeles", shift_start_minutes: 390, company_code: "JCD29854" }, error: null });
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

const run = getReport as unknown as (args: unknown) => Promise<import("./reports.functions").ReportData>;
const report = await run({ data: { range: "all" }, context: {
  userId: "eligible", supabase: {
    from: (table: string) => query(table === "pickup_requests" ? requests : table === "profiles" ? [
      { id: "eligible", full_name: "Eligible", role_name: "Technician" },
      { id: "excluded", full_name: "Excluded", role_name: "Technician" },
    ] : []),
  },
} });

test("company, employee and type counts omit the over-eight-hour claim", () => {
  expect(report.total).toBe(3);
  expect(report.claimed).toBe(2);
  expect(report.unclaimed).toBe(1);
  expect(report.employees.find((e) => e.id === "eligible")?.claims).toBe(2);
  expect(report.employees.find((e) => e.id === "excluded")?.claims).toBe(0);
  expect(report.kinds).toEqual([{ kind: "park", total: 3, claimed: 2, avgMs: 14_400_500 }]);
});

test("average, fastest and slowest include exactly eight hours but never more", () => {
  const employee = report.employees.find((e) => e.id === "eligible");
  expect(report.avgMs).toBe(14_400_500);
  expect(employee?.avgMs).toBe(14_400_500);
  expect(employee?.fastestMs).toBe(1000);
  expect(employee?.slowestMs).toBe(28_800_000);
  expect(report.anomalies).toBe(0);
});

test("excluded requests earn zero claim/submission points and no unlogged deduction", () => {
  const employee = report.employees.find((e) => e.id === "excluded");
  expect(employee?.points).toBe(0);
  expect(employee?.breakdown).toEqual({});
  expect(report.totalPoints).toBe(2.3);
});

test("submission totals and rankings use the same eligibility gate", () => {
  expect(report.submittedTotal).toBe(3);
  expect(report.submitterCount).toBe(1);
  expect(report.submitters.find((e) => e.id === "excluded")?.submissions).toBe(0);
  expect(report.employees[0]?.id).toBe("eligible");
});

test("report aggregation does not change operational request history", () => {
  expect(requests).toEqual(original);
  expect(requests).toHaveLength(4);
});
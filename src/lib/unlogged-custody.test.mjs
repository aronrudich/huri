import { expect, test } from "bun:test";
import { bayCustodyDeductions, parkClaimDeduction } from "./unlogged-custody";

const t = (m) => new Date(Date.UTC(2026, 9, 21, 15, m)).toISOString();
const row = (id, kind, m, extra = {}) => ({
  id, kind, status: "completed", created_at: t(m), claimed_at: t(m + 1), completed_at: t(m + 2),
  claimed_by: "valet", requested_by: "leo", lot_position: "SV 12", ...extra,
});

test("park claimed with no real spot logged costs the claimant", () => {
  expect(parkClaimDeduction(row("p", "park", 0), [])).toBe("valet");
  expect(parkClaimDeduction(row("p", "park", 0), [{ actor_id: "valet", created_at: t(5), dest: "SV 4" }])).toBe(null);
});

test("tech bay with no park request costs that tech once", () => {
  const list = [row("a", "pickup_tech", 0), row("b", "pickup", 60, { lot_position: "BAY" })];
  expect(bayCustodyDeductions(list, []).map((d) => d.tech)).toEqual(["leo"]);
});

test("park request hands custody to the claimant, no tech deduction", () => {
  const list = [row("a", "pickup_tech", 0), row("p", "park", 30), row("b", "pickup", 60, { lot_position: "BAY" })];
  expect(bayCustodyDeductions(list, [])).toEqual([]);
});

test("never-tracked car showing Unknown deducts nobody", () => {
  expect(bayCustodyDeductions([row("b", "pickup", 60, { lot_position: "UNKNOWN" })], [])).toEqual([]);
});

test("previously tracked Unknown deducts only with provable custody", () => {
  const custody = [row("a", "pickup_tech", 0), row("b", "pickup", 60, { lot_position: "UNKNOWN" })];
  expect(bayCustodyDeductions(custody, []).map((d) => d.tech)).toEqual(["leo"]);
  const noCustody = [row("a", "pickup", 0), row("b", "pickup", 60, { lot_position: "UNKNOWN" })];
  expect(bayCustodyDeductions(noCustody, [])).toEqual([]);
});

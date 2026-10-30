import { expect, test } from "bun:test";
import ts from "typescript";
import { readFileSync } from "node:fs";

// Exercise the demo-local pure rules without importing live app services or mounting timers.
const source = readFileSync(new URL("../components/DemoFeed.tsx", import.meta.url), "utf8");
const pure = source.slice(source.indexOf("type Kind"), source.indexOf("export function DemoFeed"));
const js = ts.transpile(pure, { target: ts.ScriptTarget.ES2022 });
const { makeReq, blockersFor, seed } = new Function(`${js}; return { makeReq, blockersFor, seed };`)();

test("demo Park origins are bays; customer and ETA origins are never bays", () => {
  for (let i = 0; i < 200; i++) {
    expect(makeReq(0, "Park").spot).toMatch(/^Bay (4|7|9|11|12|18)$/);
    for (const kind of ["Customer", "ETA"]) {
      const r = makeReq(0, kind);
      expect(r.spot).toMatch(/^(Lot [ABC] - (\d+)|Side Lot|Front Lot)$/);
      if (r.spot === "Side Lot" || r.spot === "Front Lot") expect(r.blockers).toBeUndefined();
    }
  }
});

test("demo 132 is blocked only by 131 and 130 in that same lot", () => {
  const blockers = blockersFor("Lot A", 132, 2);
  expect(blockers).toHaveLength(2);
  expect(blockers[0]).toMatch(/^Blocked by RO #\d+ in Lot A - 131$/);
  expect(blockers[1]).toMatch(/^Blocked by RO #\d+ in Lot A - 130$/);
});

test("demo ETA requests begin at 30 minutes; bottom ETAs are all beyond 30", () => {
  expect(makeReq(1000, "ETA").eta).toBe(1000 + 30 * 60000);
  const start = Date.now();
  const s = seed();
  expect(s.open).not.toBeNull();
  expect(s.claimed).toHaveLength(14);
  expect(s.upcoming).toHaveLength(4);
  for (const r of s.upcoming) expect(r.eta - start).toBeGreaterThan(30 * 60000);
});

test("notes are restricted to customer and technician pickups", () => {
  for (const kind of ["ETA", "Parts", "Park", "Wash"]) {
    for (let i = 0; i < 30; i++) expect(makeReq(0, kind).note).toBeUndefined();
  }
});
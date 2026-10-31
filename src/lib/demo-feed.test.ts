import { expect, test } from "bun:test";
import ts from "typescript";
import { readFileSync } from "node:fs";

// Exercise the demo-local pure rules without importing live app services or mounting timers.
const source = readFileSync(new URL("../components/DemoFeed.tsx", import.meta.url), "utf8");
const pure = source.slice(source.indexOf("type Kind"), source.indexOf("export function DemoFeed"));
const js = ts.transpile(pure, { target: ts.ScriptTarget.ES2022 });
const { makeReq, blockersFor, seed, addNext, KINDS } = new Function(`${js}; return { makeReq, blockersFor, seed, addNext, KINDS };`)();

test("Parts and Park use named bays; other types use lots within capacity", () => {
  for (let i = 0; i < 200; i++) {
    for (const kind of ["Parts", "Park"]) expect(makeReq(0, kind).spot).toMatch(/^(Frank|Mike|Hector|Leo|Chris)'s Bay$/);
    for (const kind of ["Customer", "ETA", "Tech", "Wash", "Stage"]) {
      const r = makeReq(0, kind);
      expect(r.spot).toMatch(/^(Lot [ABC] - (\d+)|Side Lot|Front Lot)$/);
      if (r.spot === "Side Lot" || r.spot === "Front Lot") expect(r.blockers).toBeUndefined();
      const match = r.spot.match(/^(Lot [ABC]) - (\d+)$/);
      if (match) {
        expect(Number(match[2])).toBeGreaterThanOrEqual(1);
        expect(Number(match[2])).toBeLessThanOrEqual(({ "Lot A": 150, "Lot B": 80, "Lot C": 35 } as Record<string, number>)[match[1]]);
      }
    }
  }
});

test("demo 132 is blocked only by 131 and 130 in that same lot", () => {
  const blockers = blockersFor("Lot A", 132, 2);
  expect(blockers).toHaveLength(2);
  expect(blockers[0]).toMatch(/Lot A - 131\)$/);
  expect(blockers[1]).toMatch(/Lot A - 130\)$/);
  expect(blockersFor("Lot C", 1, 2)).toHaveLength(0);
});

test("active ETAs are below 30 minutes; three bottom ETAs stay beyond 30", () => {
  for (let i = 0; i < 100; i++) {
    const eta = makeReq(1000, "ETA").eta;
    expect(eta - 1000).toBeGreaterThan(0);
    expect(eta - 1000).toBeLessThan(30 * 60000);
  }
  const start = Date.now();
  const s = seed();
  expect(s.open).not.toBeNull();
  expect(s.claimed).toHaveLength(14);
  expect(s.upcoming).toHaveLength(3);
  for (const r of s.upcoming) expect(r.eta - start).toBeGreaterThan(30 * 60000);
  for (const r of addNext(s, start + 60 * 60000).upcoming) expect(r.eta - (start + 60 * 60000)).toBeGreaterThan(30 * 60000);
});

test("initial cards and new requests follow the exact eleven-request cycle", () => {
  const order = ["Customer", "ETA", "Tech", "Park", "Customer", "Parts", "Tech", "Wash", "ETA", "Tech", "Stage"];
  expect(KINDS).toEqual(order);
  let s = seed();
  expect([s.open.kind, ...s.claimed.map((r: { kind: string }) => r.kind)]).toEqual(Array.from({ length: 15 }, (_, i) => order[i % 11]));
  for (let i = 1; i <= 33; i++) {
    s = addNext(s, Date.now());
    expect(s.open.kind).toBe(order[i % 11]);
  }
});

test("notes are restricted to customer and technician pickups", () => {
  for (const kind of ["ETA", "Parts", "Park", "Wash", "Stage"]) {
    for (let i = 0; i < 30; i++) expect(makeReq(0, kind).note).toBeUndefined();
  }
});
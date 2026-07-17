// Lot helpers — Huri supports three lots per dealership.
//
// Lot 1 (Ontario JCD, main lot): 3-deep rows, spots 1..147.
//   Rows: (1,2,3), (4,5,6), ..., (145,146,147). 1 blocks 2, 2 blocks 3.
//
// Lot C (Ontario JCD): unnumbered — every car in Lot C is stored as "C".
// Lot T (Ontario JCD): technician lot / in a bay — every car is stored as "T".
//   Both allow many cars to share the same placeholder.
//
// A raw spot string is one of: "UNKNOWN", "T", "C", or "1".."147". Stored uppercase.

export type LotId = "lot1" | "lotC" | "lotT";

export const MIN_SPOT = 1;
export const MAX_SPOT = 147;

/** Normalize a raw spot string to canonical uppercase form, or null if invalid. */
export function normalizeSpot(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim().toUpperCase();
  if (t === "" || t === "UNKNOWN") return "UNKNOWN";
  if (t === "T" || t === "C") return t;
  // Legacy "0" and "C1..C36" collapse into T / C.
  if (t === "0") return "T";
  if (/^C[0-9]+$/.test(t)) return "C";
  if (/^[0-9]+$/.test(t)) {
    const n = parseInt(t, 10);
    return n >= MIN_SPOT && n <= MAX_SPOT ? String(n) : null;
  }
  return null;
}

export function isValidSpot(raw: string): boolean {
  return normalizeSpot(raw) !== null;
}

/** Which lot a spot belongs to, or null for UNKNOWN. */
export function lotOf(raw: string | null | undefined): LotId | null {
  const n = normalizeSpot(raw);
  if (!n || n === "UNKNOWN") return null;
  if (n === "C") return "lotC";
  if (n === "T") return "lotT";
  return "lot1";
}

/** Numeric part of the spot; only meaningful for Lot 1. */
export function parseSpot(raw: string | null | undefined): number | null {
  const t = normalizeSpot(raw);
  if (!t || t === "UNKNOWN" || t === "C" || t === "T") return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

/** Spots that would block the given spot from leaving.
 *  Only applies to Lot 1: (n-1)%3 blockers within its group of 3.
 *  Lot C and Lot T never have blockers. */
export function adjacentSpots(raw: string | null | undefined): string[] {
  const t = normalizeSpot(raw);
  if (!t || t === "UNKNOWN" || t === "C" || t === "T") return [];
  const n = parseInt(t, 10);
  if (!Number.isFinite(n) || n < 1) return [];
  const posInGroup = (n - 1) % 3; // 0=front, 1=middle, 2=back
  const out: string[] = [];
  for (let i = 1; i <= posInGroup; i++) out.push(String(n - i));
  return out;
}

/** Ordered list of all spot labels for a given lot. */
export function spotsForLot(lot: LotId): string[] {
  if (lot === "lot1") {
    const out: string[] = [];
    for (let i = MIN_SPOT; i <= MAX_SPOT; i++) out.push(String(i));
    return out;
  }
  // Lot C and Lot T have no numbered spots — the list view enumerates cars, not spots.
  return [];
}

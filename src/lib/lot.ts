// Lot helpers — Huri supports multiple lots per dealership.
//
// Lot 1 (Ontario JCD): spots C1..C36.
//   C1..C10 are single spots (no blocker logic).
//   C11..C36 are stacked in pairs: odd blocks even.
//     C11 blocks C12, C13 blocks C14, ... , C35 blocks C36.
//
// Lot 2 (Ontario JCD, "the main lot"): spots 1..147 in 3-deep rows.
//   Row groups: (1,2,3), (4,5,6), ..., (145,146,147). Front→back.
//   1 blocks 2, 2 blocks 3, etc.
//
// A raw spot string is one of: "UNKNOWN", "0" (off the lot, Lot 2 only),
// "1".."147" (Lot 2), or "C1".."C36" (Lot 1). Stored uppercase.

export type LotId = "lot1" | "lot2";

export const MIN_SPOT = 1;
export const MAX_SPOT = 147; // Lot 2
export const ROWS = 3;
export const SPOTS_PER_ROW = 49;

export const LOT1_MIN = 1;
export const LOT1_MAX = 36;

/** Normalize a raw spot string to canonical uppercase form, or null if invalid. */
export function normalizeSpot(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim().toUpperCase();
  if (t === "UNKNOWN") return "UNKNOWN";
  if (/^C[0-9]+$/.test(t)) {
    const n = parseInt(t.slice(1), 10);
    return n >= LOT1_MIN && n <= LOT1_MAX ? t : null;
  }
  if (/^[0-9]+$/.test(t)) {
    const n = parseInt(t, 10);
    return n >= 0 && n <= MAX_SPOT ? t : null;
  }
  return null;
}

export function isValidSpot(raw: string): boolean {
  return normalizeSpot(raw) !== null;
}

/** Which lot a spot belongs to, or null for UNKNOWN/off-lot. */
export function lotOf(raw: string | null | undefined): LotId | null {
  const n = normalizeSpot(raw);
  if (!n || n === "UNKNOWN" || n === "0") return null;
  return n.startsWith("C") ? "lot1" : "lot2";
}

/** Parse just the numeric part of a spot; only useful for Lot 2. */
export function parseSpot(raw: string | null | undefined): number | null {
  const t = normalizeSpot(raw);
  if (!t || t === "UNKNOWN") return null;
  if (t.startsWith("C")) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

/** Spots that would block the given spot from leaving.
 *  Lot 1: pairs (C11,C12), (C13,C14), ... — odd blocks even.
 *          C1..C10 have no blockers.
 *  Lot 2: (n-1)%3 blockers within its group of 3. */
export function adjacentSpots(raw: string | null | undefined): string[] {
  const t = normalizeSpot(raw);
  if (!t || t === "UNKNOWN" || t === "0") return [];
  if (t.startsWith("C")) {
    const n = parseInt(t.slice(1), 10);
    if (n < 11) return []; // singles
    // Even C-spot is the "back" one; the odd one before it blocks it.
    if (n % 2 === 0) return [`C${n - 1}`];
    return [];
  }
  const n = parseInt(t, 10);
  if (n < 1) return [];
  const posInGroup = (n - 1) % 3; // 0=front, 1=middle, 2=back
  const out: string[] = [];
  for (let i = 1; i <= posInGroup; i++) out.push(String(n - i));
  return out;
}

/** Ordered list of all spot labels for a given lot. */
export function spotsForLot(lot: LotId): string[] {
  if (lot === "lot1") {
    const out: string[] = [];
    for (let i = LOT1_MIN; i <= LOT1_MAX; i++) out.push(`C${i}`);
    return out;
  }
  const out: string[] = [];
  for (let i = MIN_SPOT; i <= MAX_SPOT; i++) out.push(String(i));
  return out;
}

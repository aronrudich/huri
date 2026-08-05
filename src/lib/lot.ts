// Lot helpers — Huri supports SV, CP, BL, and searchable custom locations.
//
// Lot 1 (Ontario JCD, main lot): 3-deep rows, spots 1..147.
//   Rows: (1,2,3), (4,5,6), ..., (145,146,147). 1 blocks 2, 2 blocks 3.
//
// Lot C (Ontario JCD): unnumbered — every car in Lot C is stored as "C".
// Lot T (Ontario JCD): technician lot / in a bay — every car is stored as "T".
//   Both allow many cars to share the same placeholder.
//
// A raw spot string is one of: "UNKNOWN", "T", "C", or "1".."147". Stored uppercase.

export type LotId = "sv" | "cp" | "bl";
export type LocationChoice = "SV" | "CP" | "BL" | "OTHER" | null;

export const MIN_SPOT = 1;
export const MAX_SPOT = 147;

/** Normalize a raw spot string to canonical uppercase form, or null if invalid. */
export function normalizeSpot(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim().toUpperCase();
  if (t === "" || t === "UNKNOWN") return "UNKNOWN";
  if (t === "BL" || t === "CP") return t;
  if (/^SV\s*[0-9]+$/.test(t)) {
    const n = parseInt(t.replace(/^SV\s*/, ""), 10);
    return n >= MIN_SPOT && n <= MAX_SPOT ? `SV ${n}` : null;
  }
  // Normalize legacy locations while old links/forms are still open.
  if (t === "0" || t === "T") return "BL";
  if (t === "C" || /^C[0-9]+$/.test(t)) return "CP";
  if (/^[0-9]+$/.test(t)) {
    const n = parseInt(t, 10);
    return n >= MIN_SPOT && n <= MAX_SPOT ? `SV ${n}` : null;
  }
  // Anything else is a custom / special location, kept as typed (uppercased).
  return t.slice(0, 60);
}

/** Spots users may enter: 1–147, C, T, or a custom free-text location. */
export function isValidSpot(raw: string): boolean {
  const t = (raw ?? "").trim().toUpperCase();
  if (t === "") return false;
  if (/^SV\s*[0-9]+$/.test(t)) {
    const n = parseInt(t.replace(/^SV\s*/, ""), 10);
    return n >= MIN_SPOT && n <= MAX_SPOT;
  }
  return t.length <= 60;
}

/** True when the spot is a custom location, not Lot 1 / C / T / unknown. */
export function isCustomSpot(raw: string | null | undefined): boolean {
  const t = normalizeSpot(raw);
  if (!t || t === "UNKNOWN" || t === "CP" || t === "BL") return false;
  return !/^SV [0-9]+$/.test(t);
}

export function locationChoice(raw: string | null | undefined): LocationChoice {
  const normalized = normalizeSpot(raw);
  if (!normalized || normalized === "UNKNOWN") return null;
  if (normalized === "CP" || normalized === "BL") return normalized;
  if (normalized.startsWith("SV ")) return "SV";
  return "OTHER";
}



/** Which lot a spot belongs to, or null for UNKNOWN / custom locations. */
export function lotOf(raw: string | null | undefined): LotId | null {
  const n = normalizeSpot(raw);
  if (!n || n === "UNKNOWN") return null;
  if (n === "CP") return "cp";
  if (n === "BL") return "bl";
  if (!/^SV [0-9]+$/.test(n)) return null;
  return "sv";
}

/** Numeric part of the spot; only meaningful for Lot 1. */
export function parseSpot(raw: string | null | undefined): number | null {
  const t = normalizeSpot(raw);
  if (!t || !t.startsWith("SV ")) return null;
  const n = parseInt(t.slice(3), 10);
  return Number.isFinite(n) ? n : null;
}

/** Spots that would block the given spot from leaving.
 *  Only applies to Lot 1: (n-1)%3 blockers within its group of 3.
 *  Lot C and Lot T never have blockers. */
export function adjacentSpots(raw: string | null | undefined): string[] {
  const t = normalizeSpot(raw);
  if (!t || !t.startsWith("SV ")) return [];
  const n = parseInt(t.slice(3), 10);
  if (!Number.isFinite(n) || n < 1) return [];
  const posInGroup = (n - 1) % 3; // 0=front, 1=middle, 2=back
  const out: string[] = [];
  for (let i = 1; i <= posInGroup; i++) out.push(`SV ${n - i}`);
  return out;
}

/** Ordered list of all spot labels for a given lot. */
export function spotsForLot(lot: LotId): string[] {
  if (lot === "sv") {
    const out: string[] = [];
    for (let i = MIN_SPOT; i <= MAX_SPOT; i++) out.push(`SV ${i}`);
    return out;
  }
  // Lot C and Lot T have no numbered spots — the list view enumerates cars, not spots.
  return [];
}

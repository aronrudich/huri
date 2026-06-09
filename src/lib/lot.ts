// Lot helpers — spots are integers 1..147 stored as text, or 'UNKNOWN'.
// The lot is a long N–S strip with 3 rows (49 spots per row) running along
// the ~245 m strip at GPS 34.0507391,-117.5423977 (Ontario, CA).
//
// Spot numbering, per the spec, runs 1..147 sequentially:
//   Row 1 (west column):  spots   1..49   (1 at the north end → 49 at the south end)
//   Row 2 (middle column): spots  50..98
//   Row 3 (east column):  spots  99..147
//
// Adjacency for "blocker" logic is purely numeric (n-1, n+1) per the example
// in the spec where spot 83 is blocked by 82 and 84.

export const MIN_SPOT = 1;
export const MAX_SPOT = 147;
export const ROWS = 3;
export const SPOTS_PER_ROW = 49; // 49 * 3 = 147

// Anchor at the geometric center of the lot strip.
export const LOT_COORDS = { lat: 34.0507391, lng: -117.5423977 };

// Stall geometry (approximate, measured against satellite imagery of the strip):
//   - 5.5 m long  (N–S, along latitude)   →  ~4.95e-5 deg lat per spot
//   - 2.7 m wide  (E–W, along longitude)  →  ~2.93e-5 deg lng per row at lat 34°
const METERS_PER_DEG_LAT = 111_320;
const METERS_PER_DEG_LNG_AT_34 = 92_290; // 111320 * cos(34°)
const SPOT_LENGTH_M = 5.5;
const SPOT_WIDTH_M = 2.7;

const D_LAT_PER_SPOT = SPOT_LENGTH_M / METERS_PER_DEG_LAT;
const D_LNG_PER_ROW = SPOT_WIDTH_M / METERS_PER_DEG_LNG_AT_34;

export function parseSpot(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!/^[0-9]+$/.test(t)) return null;
  const n = parseInt(t, 10);
  if (n < MIN_SPOT || n > MAX_SPOT) return null;
  return n;
}

export function isValidSpot(raw: string): boolean {
  return parseSpot(raw) !== null;
}

/** Adjacent (blocker) spots: N-1 and N+1, clamped to 1..147. */
export function adjacentSpots(raw: string | null | undefined): string[] {
  const n = parseSpot(raw);
  if (n === null) return [];
  const out: string[] = [];
  if (n - 1 >= MIN_SPOT) out.push(String(n - 1));
  if (n + 1 <= MAX_SPOT) out.push(String(n + 1));
  return out;
}

/** Return { row, col } for a spot. Row is 1..3 (west→east). Col is 1..49 (north→south). */
export function spotRowCol(spot: number): { row: number; col: number } {
  const zero = spot - 1;
  const row = Math.floor(zero / SPOTS_PER_ROW) + 1;        // 1..3
  const col = (zero % SPOTS_PER_ROW) + 1;                  // 1..49
  return { row, col };
}

/** Lat/lng for the exact center of a given spot (1..147). */
export function spotToCoords(raw: string | number | null | undefined):
  { lat: number; lng: number } | null {
  const n = typeof raw === "number" ? raw : parseSpot(raw ?? null);
  if (n === null || n < MIN_SPOT || n > MAX_SPOT) return null;
  const { row, col } = spotRowCol(n);
  // Center the grid on LOT_COORDS so col 25 / row 2 ≈ anchor.
  const colOffset = col - (SPOTS_PER_ROW + 1) / 2; // -24..+24
  const rowOffset = row - (ROWS + 1) / 2;          // -1, 0, +1
  return {
    lat: LOT_COORDS.lat + colOffset * D_LAT_PER_SPOT,
    lng: LOT_COORDS.lng + rowOffset * D_LNG_PER_ROW,
  };
}

/** Google Maps satellite embed URL. If `spot` is given, drops a pin on that exact stall. */
export function satelliteEmbedUrl(spot?: string | number | null): string {
  const c = spot != null ? spotToCoords(spot) ?? LOT_COORDS : LOT_COORDS;
  return `https://maps.google.com/maps?q=${c.lat},${c.lng}&z=20&t=k&output=embed`;
}

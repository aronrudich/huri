// Lot helpers — spots are integers 1..147 stored as text, or 'UNKNOWN'.

export const MIN_SPOT = 1;
export const MAX_SPOT = 147;
export const LOT_COORDS = { lat: 34.0507391, lng: -117.5423977 };

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

/** Static satellite map URL centered on the lot, pin dropped on the lot. */
export function satelliteEmbedUrl(): string {
  return `https://maps.google.com/maps?q=${LOT_COORDS.lat},${LOT_COORDS.lng}&z=19&t=k&output=embed`;
}

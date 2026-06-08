// Lot coordinate helpers.
// Coordinates are <COLUMN><ROW>, e.g. "C2", "AB1". Columns are alpha (A..Z, AA..),
// rows are numeric 1..3.

const COORD_RE = /^([A-Z]+)([1-9][0-9]*)$/i;

export function parseCoord(raw: string | null | undefined): { col: string; row: number } | null {
  if (!raw) return null;
  const m = raw.trim().toUpperCase().match(COORD_RE);
  if (!m) return null;
  return { col: m[1], row: parseInt(m[2], 10) };
}

export function adjacentCoords(raw: string | null | undefined): string[] {
  const p = parseCoord(raw);
  if (!p) return [];
  const out: string[] = [];
  if (p.row > 1) out.push(`${p.col}${p.row - 1}`);
  out.push(`${p.col}${p.row + 1}`);
  return out;
}

export function isValidCoord(raw: string): boolean {
  return parseCoord(raw) !== null;
}

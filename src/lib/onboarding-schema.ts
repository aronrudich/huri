// Shared, client-safe shape of a business onboarding map draft.
import { z } from "zod";

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
const pt = z.tuple([lat, lng]);
const id = z.string().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/);

export const LOT_CATEGORIES = ["Service", "Sales", "Customer Pickup", "Inventory", "Auction", "Overflow", "Other"] as const;

export const draftSchema = z.object({
  businessName: z.string().trim().max(160).optional(),
  businessType: z.enum(["dealership", "auction"]).optional(),
  contactEmail: z.string().trim().max(254).optional(),
  contactName: z.string().trim().max(120).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(3000).optional(),
  address: z.object({
    street: z.string().max(200).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    zip: z.string().max(20).optional(),
    country: z.string().max(80).optional(),
    notes: z.string().max(2000).optional(),
  }).optional(),
  center: z.object({ lat, lng, zoom: z.number().min(1).max(22).optional() }).optional(),
  boundary: z.array(pt).max(300).optional(),
  boundaryConfirmed: z.boolean().optional(),
  lots: z.array(z.object({
    id, name: z.string().max(120), description: z.string().max(1000).optional(),
    category: z.enum(LOT_CATEGORIES).optional(), polygon: z.array(pt).max(300),
  })).max(60).optional(),
  rows: z.array(z.object({
    id, lotId: id, label: z.string().max(60), line: z.array(pt).max(50),
    start: z.number().int().min(0).max(100000).optional(), end: z.number().int().min(0).max(100000).optional(),
  })).max(400).optional(),
  spots: z.array(z.object({ id, lotId: id, rowId: id.optional(), label: z.string().max(40), lat, lng })).max(4000).optional(),
  barcode: z.object({
    uses: z.enum(["yes", "no", "unsure"]).optional(),
    notes: z.string().max(2000).optional(),
    sample: z.string().max(300).optional(),
  }).optional(),
});

export type Draft = z.infer<typeof draftSchema>;
export type LatLng = [number, number];
export type Lot = NonNullable<Draft["lots"]>[number];
export type Row = NonNullable<Draft["rows"]>[number];
export type Spot = NonNullable<Draft["spots"]>[number];

export const MAX_DRAFT_BYTES = 600_000;

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Ray-cast point-in-polygon (lat/lng treated as planar — fine at lot scale). */
export function inside(p: LatLng, poly: LatLng[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i], [yj, xj] = poly[j];
    if ((yi > p[0]) !== (yj > p[0]) && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Evenly spaced points along a polyline (inclusive of both ends). */
export function pointsAlong(line: LatLng[], n: number): LatLng[] {
  if (line.length < 2 || n < 1) return [];
  const seg = line.slice(1).map((p, i) => Math.hypot(p[0] - line[i][0], p[1] - line[i][1]));
  const total = seg.reduce((a, b) => a + b, 0);
  const out: LatLng[] = [];
  for (let k = 0; k < n; k++) {
    let d = n === 1 ? total / 2 : (total * k) / (n - 1);
    let i = 0;
    while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
    const t = seg[i] ? Math.min(1, d / seg[i]) : 0;
    out.push([line[i][0] + (line[i + 1][0] - line[i][0]) * t, line[i][1] + (line[i + 1][1] - line[i][1]) * t]);
  }
  return out;
}

export function draftStats(d: Draft) {
  return {
    boundary: (d.boundary?.length ?? 0) >= 3,
    lots: d.lots?.length ?? 0,
    rows: d.rows?.length ?? 0,
    spots: d.spots?.length ?? 0,
  };
}

/** Lots whose shape sits mostly outside the property — non-blocking warning. */
export function lotsOutside(d: Draft) {
  const b = d.boundary ?? [];
  if (b.length < 3) return [];
  return (d.lots ?? []).filter((l) => l.polygon.length >= 3 && l.polygon.filter((p) => inside(p, b)).length < l.polygon.length / 2);
}

export function duplicateSpotLabels(d: Draft) {
  const seen = new Set<string>(); const dup = new Set<string>();
  for (const s of d.spots ?? []) { const k = `${s.lotId}|${s.label.trim().toUpperCase()}`; if (seen.has(k)) dup.add(s.label); seen.add(k); }
  return [...dup];
}

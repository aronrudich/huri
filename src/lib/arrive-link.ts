/**
 * Customer arrival link. The company's public handle is safe to text to
 * customers — the private employee company code never appears in it.
 */
export const ARRIVE_BASE = "https://huri.team/arrive";

export const customerArrivalLink = (slug: string, ro?: string | null) =>
  `${ARRIVE_BASE}/${slug}${ro ? `?ro=${encodeURIComponent(ro.trim())}` : ""}`;

/** What a service advisor pastes into their text-message template once. */
export const customerArrivalTemplate = (slug: string) =>
  `${ARRIVE_BASE}/${slug}?ro={{repair_order_number}}`;

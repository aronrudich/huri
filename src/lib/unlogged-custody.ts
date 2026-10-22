/**
 * Shared unlogged-location custody rules. Each missing real spot produces at
 * most one -2 deduction, attributed to the one person who provably had custody.
 */
export const UNLOGGED_POINTS = -2;

export type CustodyKind = "park" | "wash" | "parts" | "stage" | "pickup_tech" | "pickup" | string;
export type CustodyRow = {
  id: string;
  kind: CustodyKind;
  status: string;
  created_at: string;
  claimed_at: string | null;
  completed_at: string | null;
  claimed_by: string | null;
  requested_by: string | null;
  lot_position: string | null;
};
export type CustodyMove = { actor_id: string | null; created_at: string; dest: string | null };

export const isRealSpot = (d: string | null | undefined) => {
  const u = (d ?? "").trim().toUpperCase();
  return !!u && u !== "UNKNOWN" && u !== "TAKEN" && u !== "WASH" && u !== "BAY" && !u.startsWith("BAY ");
};

/** a) Claimed Park request with no real spot logged from claim until 30 min after it left the list. */
export function parkClaimDeduction(r: CustodyRow, moves: CustodyMove[]): string | null {
  if (r.kind !== "park" || r.status !== "completed" || !r.claimed_by || !r.claimed_at) return null;
  const endMs = Math.max(
    Date.parse(r.claimed_at) + 30 * 60_000,
    r.completed_at ? Date.parse(r.completed_at) + 30 * 60_000 : 0,
  );
  const endIso = new Date(endMs).toISOString();
  const logged = moves.some((m) => m.actor_id && m.created_at >= r.claimed_at! && m.created_at <= endIso && isRealSpot(m.dest));
  return logged ? null : r.claimed_by;
}

/**
 * b) Technician-bay custody for one car's requests (sorted by created_at, parts and
 * shortcut rows removed). A tech whose pickup put the car in their bay is deducted when
 * the next request (not park/wash) shows Bay or Unknown and they never logged a real spot.
 * A Park request hands custody to its claimant (rule a), so the tech is never also deducted.
 * Cars with no earlier tech pickup (never tracked) produce no deduction.
 */
export function bayCustodyDeductions(
  list: CustodyRow[],
  moves: CustodyMove[],
): { tech: string; ender: CustodyRow }[] {
  const out: { tech: string; ender: CustodyRow }[] = [];
  const judged = new Set<string>(); // one deduction per finding request
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    if (r.kind !== "pickup_tech" || r.status !== "completed" || !r.requested_by) continue;
    const tech = r.requested_by;
    const prev = i > 0 ? list[i - 1] : null;
    if (prev && prev.kind === "pickup_tech" && prev.requested_by === tech) continue; // same stay
    const arrived = r.claimed_at ?? r.created_at;
    const ender = list.slice(i + 1).find((n) => n.created_at > arrived);
    if (!ender) continue; // still in custody
    if (ender.kind === "park" || ender.kind === "wash") continue; // proper hand-off
    if (judged.has(ender.id)) continue;
    const selfLogged = moves.some((m) =>
      m.actor_id === tech && m.created_at >= arrived && m.created_at <= ender.created_at && isRealSpot(m.dest));
    if (selfLogged) continue;
    const snap = (ender.lot_position ?? "").trim().toUpperCase() || "UNKNOWN";
    if (snap === "UNKNOWN" || snap === "BAY" || snap.startsWith("BAY ")) {
      judged.add(ender.id);
      out.push({ tech, ender });
    }
  }
  return out;
}

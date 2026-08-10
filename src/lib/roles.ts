// Role capabilities for Huri.
//
// Two distinct valet-facing actions exist and must never be merged:
//   "New"  — log a car into the system (no notification).
//   "Park" — ask a valet to come to the technician's bay and park their car.

export type ActionId = "pickup" | "new" | "stage" | "parts" | "shuttle" | "park";

export const VALET_ROLES = ["Valet", "Valet & Parts", "Valet & Shuttle"];
export const SHUTTLE_ROLES = ["Shuttle", "Valet & Shuttle"];

export const isTechRole = (role: string | null | undefined) =>
  role === "Technician" || role === "Shop Foreman";

export const isValetRole = (role: string | null | undefined) =>
  VALET_ROLES.includes(role ?? "");

export const isShuttleRole = (role: string | null | undefined) =>
  SHUTTLE_ROLES.includes(role ?? "");

/** Header actions, in the exact top-to-bottom order they should appear. */
export function actionsForRole(role: string | null | undefined): ActionId[] {
  const r = role ?? "";
  if (r === "Shuttle") return [];
  if (isValetRole(r)) return ["new"];
  if (r === "Advisor") return ["pickup", "new", "stage", "shuttle"];
  if (isTechRole(r)) return ["pickup", "parts", "park", "new"];
  return ["pickup", "new", "stage", "parts", "shuttle", "park"];
}

/** Which pickup-list submissions a role is allowed to see. */
export function canSeeKind(role: string | null | undefined, kind: string | null | undefined) {
  const r = role ?? "";
  const k = kind ?? "pickup";
  if (r === "Shuttle") return k === "shuttle";
  if (r === "Valet & Shuttle") return k !== "parts";
  if (isValetRole(r)) return k !== "shuttle";
  return true;
}

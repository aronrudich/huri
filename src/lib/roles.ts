// Role capabilities for Huri.
//
// Two distinct valet-facing actions exist and must never be merged:
//   "New"  — log a car into the system (no notification).
//   "Park" — ask a valet to come to the technician's bay and park their car.

export type ActionId = "pickup" | "new" | "stage" | "parts" | "shuttle" | "park";

export const VALET_ROLES = ["Valet", "Valet & Parts", "Valet & Shuttle"];
export const SHUTTLE_ROLES = ["Shuttle", "Valet & Shuttle"];

/** Every role a user can be assigned, in display order. */
export const ROLE_OPTIONS = [
  "Valet",
  "Valet & Parts",
  "Shuttle",
  "Valet & Shuttle",
  "Advisor",
  "Technician",
  "Shop Foreman",
  "Service Manager",
  "Service Director",
  "General Manager",
  "Manager",
  "Director",
  "Admin",
  "Other",
];

/** Roles that handle join requests and role change approvals. */
export const APPROVER_ROLES = ["Admin"];

export const isApproverRole = (role: string | null | undefined) =>
  APPROVER_ROLES.includes(role ?? "");

/** Roles that can see the employee roster. */
export const MANAGEMENT_ROLES = [
  "Admin",
  "Manager",
  "Service Manager",
  "Assistant Service Manager",
  "Parts Manager",
  "Service Director",
  "General Manager",
  "Director",
];


export const isTechRole = (role: string | null | undefined) =>
  role === "Technician" || role === "Shop Foreman";

export const isValetRole = (role: string | null | undefined) =>
  VALET_ROLES.includes(role ?? "");

export const isShuttleRole = (role: string | null | undefined) =>
  SHUTTLE_ROLES.includes(role ?? "");

/**
 * Who can stage a car (advisors, admins, and any manager/director title).
 * Admin shares the manager app layout — only approvals differ.
 */
export const canStageRole = (role: string | null | undefined) => {
  const r = role ?? "";
  return r === "Advisor" || r === "Admin" || /manager|director/i.test(r);
};

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

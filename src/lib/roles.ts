// Role capabilities for Huri.
//
// Two distinct valet-facing actions exist and must never be merged:
//   "New"  — log a car into the system (no notification).
//   "Park" — ask a valet to come to the technician's bay and park their car.

export type ActionId = "pickup" | "new" | "stage" | "parts" | "park" | "bringme" | "wash" | "reports" | "flagged" | "settings" | "help";

export const VALET_ROLES = ["Valet", "Valet Supervisor"];

/** Every role a user can be assigned, in display order. */
export const ROLE_OPTIONS = [
  "Valet",
  "Valet Supervisor",
  "Car Wash",
  "Advisor",
  "Technician",
  "Shop Foreman",
  "Service Manager",
  "Service Director",
  "General Manager",
  "Manager",
  "Director",
  "Admin",
  "Spectator",
  "Other",
];

/** Roles with the full administrative capability set. */
export const ADMIN_ROLES = ["Admin", "Service Manager", "Service Director"];

export const isAdminRole = (role: string | null | undefined) =>
  ADMIN_ROLES.includes(role ?? "");

/** Read-only role: can browse Huri but never submits, claims, or messages. */
export const isSpectatorRole = (role: string | null | undefined) =>
  (role ?? "") === "Spectator";

/** Roles that can open the Reports screen. */
export const REPORTS_ROLES = [
  "Admin",
  "Service Manager",
  "Service Director",
  "General Manager",
  "Spectator",
  "Valet Supervisor",
  "Shop Foreman",
];

export const canViewReports = (role: string | null | undefined) =>
  REPORTS_ROLES.includes(role ?? "");

/** Roles that can open the Flagged Cars (14+ day) list. */
export const FLAGGED_ROLES = [
  "Admin",
  "Service Manager",
  "Service Director",
  "General Manager",
  "Spectator",
];

export const canViewFlagged = (role: string | null | undefined) =>
  FLAGGED_ROLES.includes(role ?? "");


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

/**
 * Upper management: they can see the company code, approve new employees and
 * role changes, and edit their company's settings. Mirrors
 * private.is_upper_management() in the database.
 */
export const UPPER_MANAGEMENT_ROLES = MANAGEMENT_ROLES;

export const isUpperManagementRole = (role: string | null | undefined) =>
  UPPER_MANAGEMENT_ROLES.includes(role ?? "");

/** Roles that handle join requests and role change approvals. */
export const APPROVER_ROLES = UPPER_MANAGEMENT_ROLES;

export const isApproverRole = (role: string | null | undefined) =>
  APPROVER_ROLES.includes(role ?? "");


/**
 * Roles allowed to cancel anyone's submission. Technicians can only cancel
 * their own so nobody kills another employee's request by mistake.
 */
export const CANCEL_ANY_ROLES = [
  "Admin",
  "Manager",
  "Service Manager",
  "Assistant Service Manager",
  "Parts Manager",
  "Director",
  "Service Director",
  "General Manager",
  "Shop Foreman",
  "Advisor",
  ...VALET_ROLES,
];

export const canCancelAnyRole = (role: string | null | undefined) =>
  CANCEL_ANY_ROLES.includes(role ?? "");


export const isTechRole = (role: string | null | undefined) =>
  role === "Technician" || role === "Shop Foreman";

export const isValetRole = (role: string | null | undefined) =>
  VALET_ROLES.includes(role ?? "");

/**
 * Who can stage a car (advisors, admins, and any manager/director title).
 * Admin shares the manager app layout — only approvals differ.
 */
export const canStageRole = (role: string | null | undefined) => {
  const r = role ?? "";
  return r === "Advisor" || r === "Admin" || /manager|director/i.test(r);
};

/** Management roles (with Reports access) that can open Company Settings. */
export const SETTINGS_ROLES = ["Admin", "Service Manager", "Service Director", "General Manager"];

export const canViewSettings = (role: string | null | undefined, isOwner?: boolean | null) =>
  !!isOwner || SETTINGS_ROLES.includes(role ?? "");

/** Company-level switches that hide optional departments from the menu. */
export type ActionModules = {
  enable_wash?: boolean;
  enable_parts?: boolean;
  enable_staging?: boolean;
  isOwner?: boolean;
};

/** Header actions, in the exact top-to-bottom order they should appear. */
export function actionsForRole(
  role: string | null | undefined,
  modules?: ActionModules,
): ActionId[] {
  const r = role ?? "";
  const withReports = (ids: ActionId[]): ActionId[] => {
    const out = [...ids];
    if (canViewReports(r)) out.push("reports");
    if (canViewFlagged(r)) out.push("flagged");
    return out;
  };
  const base = (): ActionId[] => {
    // Spectators are read-only: they can only open the view-only screens.
    if (isSpectatorRole(r)) return ["reports", "flagged"];
    // The car wash employee doesn't request washes — they just relocate cars once washed.
    if (r === "Car Wash") return ["new"];
    if (isValetRole(r)) return withReports(["new"]);
    if (r === "Advisor") return withReports(["pickup", "new", "stage", "wash"]);
    if (isTechRole(r)) return withReports(["bringme", "park", "new", "wash"]);
    return withReports(["pickup", "new", "stage", "parts", "park", "wash"]);
  };

  const off = (flag: boolean | undefined) => flag === false;
  let items = base().filter((id) => {
    if (id === "wash" && off(modules?.enable_wash)) return false;
    if (id === "parts" && off(modules?.enable_parts)) return false;
    if (id === "stage" && off(modules?.enable_staging)) return false;
    return true;
  });

  // Only reporting management (and the owner) can open company settings.
  if (canViewSettings(r, modules?.isOwner)) items = [...items, "settings"];
  // Everyone can reach Huri support.
  return [...items, "help"];
}

/**
 * Which pickup-list submissions a role is allowed to see.
 * Everyone sees every submission type and can claim any of them.
 */
export function canSeeKind(_role?: string | null, _kind?: string | null) {
  return true;
}


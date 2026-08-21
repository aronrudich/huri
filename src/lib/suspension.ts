import { useAuth } from "./auth-context";
import { isSuspendedRole } from "./roles";

/**
 * True when the signed-in account belongs to a suspended role.
 *
 * Suspended accounts keep working visually: screens load, forms submit, and the
 * usual confirmation toast appears — nothing is written and nobody is notified.
 * The user must never be able to tell, so never render a banner or an error for
 * this state.
 */
export function useSuspended() {
  const { profile } = useAuth();
  return isSuspendedRole(profile?.role_name);
}

/** Server-safe variant for handlers that already loaded the caller's profile. */
export const suspendedRole = isSuspendedRole;

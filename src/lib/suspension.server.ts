import { isSuspendedRole, SUSPENDED_ROLES } from "./roles";

/** Role names whose accounts are suspended (kept alive, but powerless). */
export const suspendedRoleNames = SUSPENDED_ROLES;

/** True when this user's role is suspended. Never surface this to the user. */
export async function isSuspendedUser(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles").select("role_name").eq("id", userId).maybeSingle();
  return isSuspendedRole(data?.role_name);
}

/** Drop suspended accounts out of any notification recipient list. */
export async function withoutSuspended(userIds: string[]) {
  if (!userIds.length) return userIds;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles").select("id, role_name").in("id", userIds);
  const blocked = new Set((data ?? []).filter((p) => isSuspendedRole(p.role_name)).map((p) => p.id));
  return userIds.filter((id) => !blocked.has(id));
}

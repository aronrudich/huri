import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, assertOwner, notifyAdmins, targetInDealership } from "@/lib/admin.server";

// Approvals list (admins in the same dealership)
export const listPendingApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { dealershipId } = await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pendingAccounts } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, nickname, email, role_name, created_at")
      .eq("dealership_id", dealershipId)
      .eq("status", "pending").eq("is_active", true)
      .order("created_at", { ascending: true });
    const { data: pendingRoles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, nickname, email, role_name, pending_role_name")
      .eq("dealership_id", dealershipId)
      .eq("status", "approved").eq("is_active", true)
      .not("pending_role_name", "is", null);
    return {
      accounts: pendingAccounts ?? [],
      roleChanges: pendingRoles ?? [],
    };
  });

export const approveAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { dealershipId } = await assertAdmin(context.userId);
    await targetInDealership(data.userId, dealershipId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles")
      .update({ status: "approved" }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const denyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { dealershipId } = await assertAdmin(context.userId);
    await targetInDealership(data.userId, dealershipId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const requestRoleChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ newRole: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("full_name, role_name, dealership_id").eq("id", context.userId).maybeSingle();
    if (prof?.role_name === data.newRole) {
      await supabaseAdmin.from("profiles").update({ pending_role_name: null }).eq("id", context.userId);
      return { ok: true };
    }
    const { error } = await supabaseAdmin.from("profiles")
      .update({ pending_role_name: data.newRole }).eq("id", context.userId);
    if (error) throw new Error(error.message);
    if (prof?.dealership_id) {
      await notifyAdmins(
        prof.dealership_id,
        "Role change requested",
        `${prof?.full_name ?? "Someone"} wants to switch to ${data.newRole}`,
      );
    }
    return { ok: true };
  });

export const approveRoleChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { dealershipId } = await assertAdmin(context.userId);
    await targetInDealership(data.userId, dealershipId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("pending_role_name").eq("id", data.userId).maybeSingle();
    if (!prof?.pending_role_name) return { ok: true };
    const { data: roleRow } = await supabaseAdmin
      .from("roles").upsert({ name: prof.pending_role_name }, { onConflict: "name" })
      .select("id").maybeSingle();
    const { error } = await supabaseAdmin.from("profiles")
      .update({ role_name: prof.pending_role_name, role_id: roleRow?.id ?? null, pending_role_name: null })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const denyRoleChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { dealershipId } = await assertAdmin(context.userId);
    await targetInDealership(data.userId, dealershipId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles")
      .update({ pending_role_name: null }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Admin-initiated role change — bypasses the pending-approval flow.
export const setEmployeeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), newRole: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const { dealershipId } = await assertAdmin(context.userId);
    await targetInDealership(data.userId, dealershipId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRow } = await supabaseAdmin
      .from("roles").upsert({ name: data.newRole }, { onConflict: "name" })
      .select("id").maybeSingle();
    const { error } = await supabaseAdmin.from("profiles")
      .update({ role_name: data.newRole, role_id: roleRow?.id ?? null, pending_role_name: null })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOwnAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { dealershipId } = await assertAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("You can't remove yourself.");
    await targetInDealership(data.userId, dealershipId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Never let a non-owner remove the owner
    const { data: target } = await supabaseAdmin
      .from("profiles").select("is_owner").eq("id", data.userId).maybeSingle();
    if (target?.is_owner) throw new Error("Only the owner can transfer ownership before being removed.");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const transferOwnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { dealershipId } = await assertOwner(context.userId);
    if (data.userId === context.userId) throw new Error("Already the owner.");
    await targetInDealership(data.userId, dealershipId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: e1 } = await supabaseAdmin.from("profiles")
      .update({ is_owner: false }).eq("id", context.userId);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await supabaseAdmin.from("profiles")
      .update({ is_owner: true, status: "approved" }).eq("id", data.userId);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

// Called from auth flow after signup to notify admins about a pending new account
export const notifyOwnerOfPendingSignup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ fullName: z.string(), role: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("dealership_id").eq("id", context.userId).maybeSingle();
    if (prof?.dealership_id) {
      await notifyAdmins(prof.dealership_id, "New account waiting", `${data.fullName} signed up as ${data.role}`);
    }
    return { ok: true };
  });

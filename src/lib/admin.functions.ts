import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idSchema = z.object({ userId: z.string().uuid() });
const roleReqSchema = z.object({ newRole: z.string().trim().min(1).max(120) });

const ADMIN_ROLES = new Set([
  "Manager",
  "Service Manager",
  "Service Director",
  "General Manager",
  "Director",
]);

type CallerCtx = { dealershipId: string; isOwner: boolean; isAdmin: boolean };

async function callerContext(userId: string): Promise<CallerCtx> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("is_owner, role_name, status, is_active, dealership_id")
    .eq("id", userId).maybeSingle();
  const isOwner = !!data?.is_owner;
  const isAdmin =
    isOwner ||
    (!!data &&
      data.is_active === true &&
      data.status === "approved" &&
      ADMIN_ROLES.has(data.role_name ?? ""));
  return { dealershipId: data?.dealership_id ?? "", isOwner, isAdmin };
}

async function assertAdmin(userId: string): Promise<CallerCtx> {
  const ctx = await callerContext(userId);
  if (!ctx.isAdmin) throw new Error("Manager or owner only.");
  return ctx;
}

async function assertOwner(userId: string): Promise<CallerCtx> {
  const ctx = await callerContext(userId);
  if (!ctx.isOwner) throw new Error("Owner only.");
  return ctx;
}

async function targetInDealership(targetId: string, dealershipId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles").select("dealership_id").eq("id", targetId).maybeSingle();
  if (!data || data.dealership_id !== dealershipId) {
    throw new Error("That employee is not in your dealership.");
  }
}

async function notifyAdmins(dealershipId: string, title: string, body: string, url = "/profile") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendWebPush } = await import("./push-server.server");
  const { data: admins } = await supabaseAdmin
    .from("profiles")
    .select("id, is_owner, role_name")
    .eq("dealership_id", dealershipId)
    .eq("is_active", true)
    .eq("status", "approved");
  const adminIds = (admins ?? [])
    .filter((p) => p.is_owner || ADMIN_ROLES.has(p.role_name ?? ""))
    .map((p) => p.id);
  if (!adminIds.length) return;
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions").select("id, endpoint, p256dh, auth")
    .in("user_id", adminIds);
  if (!subs?.length) return;
  const payload = { title, body, url, tag: "huri-approval" };
  const stale: string[] = [];
  await Promise.all(subs.map(async (s) => {
    try { await sendWebPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload); }
    catch (e: unknown) {
      const code = (e as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) stale.push(s.id);
    }
  }));
  if (stale.length) await supabaseAdmin.from("push_subscriptions").delete().in("id", stale);
}

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
  .inputValidator((d) => idSchema.parse(d))
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
  .inputValidator((d) => idSchema.parse(d))
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
  .inputValidator((d) => roleReqSchema.parse(d))
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
  .inputValidator((d) => idSchema.parse(d))
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
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { dealershipId } = await assertAdmin(context.userId);
    await targetInDealership(data.userId, dealershipId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles")
      .update({ pending_role_name: null }).eq("id", data.userId);
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
  .inputValidator((d) => idSchema.parse(d))
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
  .inputValidator((d) => idSchema.parse(d))
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

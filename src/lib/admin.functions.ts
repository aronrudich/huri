import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idSchema = z.object({ userId: z.string().uuid() });
const roleReqSchema = z.object({ newRole: z.string().trim().min(1).max(120) });

async function assertOwner(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("profiles").select("is_owner").eq("id", userId).maybeSingle();
  if (error || !data?.is_owner) throw new Error("Owner only.");
}

async function notifyOwners(title: string, body: string, url = "/profile") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendWebPush } = await import("./push-server.server");
  const { data: owners } = await supabaseAdmin
    .from("profiles").select("id").eq("is_owner", true).eq("is_active", true);
  if (!owners?.length) return;
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions").select("id, endpoint, p256dh, auth")
    .in("user_id", owners.map((o) => o.id));
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

// Listed for the owner: pending new accounts + pending role changes
export const listPendingApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pendingAccounts } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, nickname, email, role_name, created_at")
      .eq("status", "pending").eq("is_active", true)
      .order("created_at", { ascending: true });
    const { data: pendingRoles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, nickname, email, role_name, pending_role_name")
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
    await assertOwner(context.userId);
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
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Anyone signed in can request a role change
export const requestRoleChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => roleReqSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("full_name, role_name").eq("id", context.userId).maybeSingle();
    if (prof?.role_name === data.newRole) {
      await supabaseAdmin.from("profiles").update({ pending_role_name: null }).eq("id", context.userId);
      return { ok: true };
    }
    const { error } = await supabaseAdmin.from("profiles")
      .update({ pending_role_name: data.newRole }).eq("id", context.userId);
    if (error) throw new Error(error.message);
    await notifyOwners(
      "Role change requested",
      `${prof?.full_name ?? "Someone"} wants to switch to ${data.newRole}`,
    );
    return { ok: true };
  });

export const approveRoleChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
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
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles")
      .update({ pending_role_name: null }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Full deletion (owner removes someone, or someone leaves)
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
    await assertOwner(context.userId);
    if (data.userId === context.userId) throw new Error("You can't remove yourself.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const transferOwnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    if (data.userId === context.userId) throw new Error("Already the owner.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: e1 } = await supabaseAdmin.from("profiles")
      .update({ is_owner: false }).eq("id", context.userId);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await supabaseAdmin.from("profiles")
      .update({ is_owner: true, status: "approved" }).eq("id", data.userId);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

// Called from auth flow after signup to notify owner about pending new account
export const notifyOwnerOfPendingSignup = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ fullName: z.string(), role: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await notifyOwners("New account waiting", `${data.fullName} signed up as ${data.role}`);
    return { ok: true };
  });

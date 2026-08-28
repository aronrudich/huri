import { isAdminRole } from "@/lib/roles";

export type CallerCtx = { dealershipId: string; isOwner: boolean; isAdmin: boolean };

export async function callerContext(userId: string): Promise<CallerCtx> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("is_owner, role_name, status, is_active, dealership_id")
    .eq("id", userId)
    .maybeSingle();
  const isOwner = !!data?.is_owner;
  const isAdmin =
    isOwner ||
    (!!data &&
      data.is_active === true &&
      data.status === "approved" &&
      isAdminRole(data.role_name));
  return { dealershipId: data?.dealership_id ?? "", isOwner, isAdmin };
}

export async function assertAdmin(userId: string): Promise<CallerCtx> {
  const ctx = await callerContext(userId);
  if (!ctx.isAdmin) throw new Error("Admins only.");
  return ctx;
}

export async function assertOwner(userId: string): Promise<CallerCtx> {
  const ctx = await callerContext(userId);
  if (!ctx.isOwner) throw new Error("Owner only.");
  return ctx;
}

export async function targetInDealership(targetId: string, dealershipId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("dealership_id")
    .eq("id", targetId)
    .maybeSingle();
  if (!data || data.dealership_id !== dealershipId) {
    throw new Error("That employee is not in your dealership.");
  }
}

export async function notifyAdmins(dealershipId: string, title: string, body: string, url = "/profile") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendWebPush } = await import("./push-server.server");
  const { data: admins } = await supabaseAdmin
    .from("profiles")
    .select("id, is_owner, role_name")
    .eq("dealership_id", dealershipId)
    .eq("is_active", true)
    .eq("status", "approved");
  const adminIds = (admins ?? [])
    .filter((profile) => profile.is_owner || isAdminRole(profile.role_name))
    .map((profile) => profile.id);
  if (!adminIds.length) return;
  const { data: subscriptions } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", adminIds);
  if (!subscriptions?.length) return;
  const payload = { title, body, url, tag: "huri-approval" };
  const stale: string[] = [];
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await sendWebPush(
        { endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth },
        payload,
      );
    } catch (error: unknown) {
      const code = (error as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) stale.push(subscription.id);
    }
  }));
  if (stale.length) await supabaseAdmin.from("push_subscriptions").delete().in("id", stale);
}
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isStalePushStatus, isBadSubscriptionStatus } from "./push-server.server";

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, never>) => d)
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendWebPush } = await import("./push-server.server");

    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", context.userId);
    if (!subs?.length) return { sent: 0, pruned: 0 };

    const payload = {
      title: "Huri test notification",
      body: "If you see this, push is working on this device.",
      url: "/",
      tag: "huri-test",
      variant: "default",
    };

    let sent = 0;
    const stale: string[] = [];
    await Promise.all(subs.map(async (s) => {
      try {
        await sendWebPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload);
        sent++;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (isStalePushStatus(code)) stale.push(s.id);
        else console.warn("test push fail", code, (e as Error)?.message);
      }
    }));
    if (stale.length) await supabaseAdmin.from("push_subscriptions").delete().in("id", stale);
    return { sent, pruned: stale.length };
  });

export const sendMessagePush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    threadId: string;
    body: string;
    recipientId?: string | null;
    recipientRoleId?: string | null;
    isAnonymous?: boolean;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendWebPush } = await import("./push-server.server");

    const { data: caller } = await supabaseAdmin
      .from("profiles").select("dealership_id").eq("id", context.userId).maybeSingle();
    if (!caller?.dealership_id) return { sent: 0 };

    // Helper: expand a role_id to include Shop Foreman when the role is Technician.
    const membersForRole = async (roleId: string) => {
      const { data: roleRow } = await supabaseAdmin
        .from("roles").select("name").eq("id", roleId).maybeSingle();
      let roleNames: string[] | null = null;
      if (roleRow?.name === "Technician") roleNames = ["Technician", "Shop Foreman"];
      let q = supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("dealership_id", caller.dealership_id)
        .eq("is_active", true);
      q = roleNames ? q.in("role_name", roleNames) : q.eq("role_id", roleId);
      q = q.eq("notifications_enabled", true);
      const { data: members } = await q;
      return (members ?? []).map((m) => m.id);
    };

    // Resolve recipient user ids
    let recipientIds: string[] = [];

    // Per-starter group thread format: group:{roleId}:{starterId}
    const groupMatch = data.threadId.match(/^group:([^:]+):([^:]+)$/);

    if (data.recipientId) {
      recipientIds = [data.recipientId];
    } else if (groupMatch) {
      const [, roleId, starterId] = groupMatch;
      const ids = new Set<string>(await membersForRole(roleId));
      ids.add(starterId);
      ids.delete(context.userId);
      recipientIds = Array.from(ids);
    } else if (data.recipientRoleId) {
      const ids = await membersForRole(data.recipientRoleId);
      recipientIds = ids.filter((id) => id !== context.userId);
    }
    if (!recipientIds.length) return { sent: 0 };


    // Sender name + role
    let senderName = "Someone";
    let senderRole: string | null = null;
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("full_name, nickname, role_name").eq("id", context.userId).maybeSingle();
    senderName = prof?.nickname || prof?.full_name || "Someone";
    senderRole = prof?.role_name ?? null;

    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", recipientIds);
    if (!subs?.length) return { sent: 0 };

    const preview = data.body.length > 140 ? data.body.slice(0, 137) + "…" : data.body;
    const isTech = senderRole === "Technician";
    const payload = {
      title: `${isTech ? "🚨 " : "💬 "}${senderName}`,
      body: preview,
      url: `/thread/${data.threadId}`,
      tag: `msg-${data.threadId}`,
      variant: isTech ? "tech" : "default",
    };

    let sent = 0;
    const stale: string[] = [];
    const rejected: string[] = [];
    await Promise.all(subs.map(async (s) => {
      try {
        await sendWebPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload);
        sent++;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (isStalePushStatus(code)) stale.push(s.id);
        else if (isBadSubscriptionStatus(code)) rejected.push(s.id);
        else console.warn("msg push fail", code, (e as Error)?.message);
      }
    }));
    if (sent > 0 && rejected.length) stale.push(...rejected);
    if (stale.length) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", stale);
    }
    return { sent, pruned: stale.length };
  });


import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
        if (code === 404 || code === 410) stale.push(s.id);
        else console.warn("test push fail", code, (e as Error)?.message);
      }
    }));
    if (stale.length) await supabaseAdmin.from("push_subscriptions").delete().in("id", stale);
    return { sent, pruned: stale.length };
  });

export const sendPickupAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    tag?: string | null;
    ro?: string | null;
    advisor?: string | null;
    model?: string | null;
    sourceRole?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendWebPush } = await import("./push-server.server");

    const { data: caller } = await supabaseAdmin
      .from("profiles").select("dealership_id").eq("id", context.userId).maybeSingle();
    if (!caller?.dealership_id) return { sent: 0 };

    const { data: valets, error: vErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("dealership_id", caller.dealership_id)
      .in("role_name", ["Valet", "Valet & Parts"])
      .eq("is_active", true);
    if (vErr) throw vErr;
    if (!valets?.length) return { sent: 0 };

    const { data: subs, error: sErr } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", valets.map((v) => v.id));
    if (sErr) throw sErr;
    if (!subs?.length) return { sent: 0 };


    const isTech = data.sourceRole === "Technician";
    const body =
      [data.ro && `RO #${data.ro}`, data.tag && `Tag #${data.tag}`, data.advisor, data.model]
        .filter(Boolean).join(" · ") || "Open Huri";
    const payload = {
      title: isTech ? "🚨 Tech pickup request" : "New pickup request",
      body,
      url: "/pickup",
      tag: "pickup",
      variant: isTech ? "tech" : "default",
    };

    let sent = 0;
    const stale: string[] = [];
    await Promise.all(subs.map(async (s) => {
      try {
        await sendWebPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload);
        sent++;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) stale.push(s.id);
        else console.warn("push fail", code, (e as Error)?.message);
      }
    }));

    if (stale.length) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", stale);
    }
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

    // Helper: expand a role_id to include Valet & Parts users when the role is Valet.
    const membersForRole = async (roleId: string) => {
      const { data: roleRow } = await supabaseAdmin
        .from("roles").select("name").eq("id", roleId).maybeSingle();
      const roleNames = roleRow?.name === "Valet" ? ["Valet", "Valet & Parts"] : null;
      let q = supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("dealership_id", caller.dealership_id)
        .eq("is_active", true);
      q = roleNames ? q.in("role_name", roleNames) : q.eq("role_id", roleId);
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
    await Promise.all(subs.map(async (s) => {
      try {
        await sendWebPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload);
        sent++;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) stale.push(s.id);
        else console.warn("msg push fail", code, (e as Error)?.message);
      }
    }));
    if (stale.length) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", stale);
    }
    return { sent, pruned: stale.length };
  });

export const sendPartsAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { techName?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendWebPush } = await import("./push-server.server");

    // Insert a parts request into the pickup queue so Valet & Parts can see it in the list.
    await supabaseAdmin.from("pickup_requests").insert({
      kind: "parts",
      source_role: "Technician",
      advisor_name: data.techName ?? null,
      requested_by: context.userId,
      status: "unclaimed",
    });

    const { data: recipients, error: rErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("role_name", "Valet & Parts")
      .eq("is_active", true);
    if (rErr) throw rErr;
    if (!recipients?.length) return { sent: 0 };

    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", recipients.map((r) => r.id));
    if (!subs?.length) return { sent: 0 };

    const body = data.techName
      ? `${data.techName} needs parts brought to their bay.`
      : "A technician needs parts brought to their bay.";
    const payload = {
      title: "🚨 Parts request",
      body,
      url: "/pickup",
      tag: "parts",
      variant: "tech",
    };

    let sent = 0;
    const stale: string[] = [];
    await Promise.all(subs.map(async (s) => {
      try {
        await sendWebPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload);
        sent++;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) stale.push(s.id);
        else console.warn("parts push fail", code, (e as Error)?.message);
      }
    }));
    if (stale.length) await supabaseAdmin.from("push_subscriptions").delete().in("id", stale);
    return { sent, pruned: stale.length };
  });

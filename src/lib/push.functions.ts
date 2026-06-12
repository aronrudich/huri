import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendPickupAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tag?: string | null; ro?: string | null; advisor?: string | null; model?: string | null }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendWebPush } = await import("./push-server.server");

    // Find active valets
    const { data: valets, error: vErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("role_name", "Valet")
      .eq("is_active", true);
    if (vErr) throw vErr;
    if (!valets?.length) return { sent: 0 };

    const { data: subs, error: sErr } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", valets.map((v) => v.id));
    if (sErr) throw sErr;
    if (!subs?.length) return { sent: 0 };

    const body =
      [data.tag && `Tag #${data.tag}`, data.ro && `RO #${data.ro}`, data.advisor, data.model]
        .filter(Boolean).join(" · ") || "Open Huri";
    const payload = { title: "New pickup request", body, url: "/pickup", tag: "pickup" };

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

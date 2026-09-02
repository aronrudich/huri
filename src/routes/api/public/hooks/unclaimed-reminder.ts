import { createFileRoute } from "@tanstack/react-router";

/** One follow-up push per submission, 5 minutes after it was created. */
const REMIND_AFTER_MS = 5 * 60 * 1000;

const audienceFor = (kind: string | null) => {
  // Parts follows the same audience as every other pickup-list submission.
  return ["Valet", "Admin"];
};

export const Route = createFileRoute("/api/public/hooks/unclaimed-reminder")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Authenticated with a private scheduler token — never the publishable app key,
        // which ships in the browser bundle.
        const provided = request.headers.get("x-cron-secret");
        const expected = process.env["CRON_WEBHOOK_TOKEN"] ?? process.env["CRON_WEBHOOK_SECRET"];
        if (!expected || provided !== expected) return new Response("Unauthorized", { status: 401 });


        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendWebPush } = await import("@/lib/push-server.server");

        const cutoff = new Date(Date.now() - REMIND_AFTER_MS).toISOString();
        const { data: pending, error } = await supabaseAdmin
          .from("pickup_requests")
          .select("id, dealership_id, kind, ro_number, advisor_name, customer_name, car_notes, is_staged, created_at")
          .eq("status", "unclaimed")
          .is("reminded_at", null)
          .lte("created_at", cutoff);
        if (error) throw error;

        let sent = 0;
        for (const p of pending ?? []) {
          const { data: recipients } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("dealership_id", p.dealership_id)
            .eq("is_active", true)
            .eq("notifications_enabled", true)
            .in("role_name", audienceFor(p.kind));
          const ids = (recipients ?? []).map((r) => r.id);

          if (ids.length) {
            const { data: subs } = await supabaseAdmin
              .from("push_subscriptions")
              .select("id, endpoint, p256dh, auth")
              .in("user_id", ids);
            const body = [
              p.ro_number && `RO #${p.ro_number}`,
              p.customer_name,
              p.advisor_name,
              p.car_notes,
            ].filter(Boolean).join(" · ") || "Open Huri";
            const payload = {
              title: "⏰ Still unclaimed — 5 minutes",
              body,
              url: "/pickup",
              tag: `reminder-${p.id}`,
              variant: "tech",
            };
            const stale: string[] = [];
            await Promise.all((subs ?? []).map(async (s) => {
              try {
                await sendWebPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload);
                sent++;
              } catch (e: unknown) {
                const code = (e as { statusCode?: number })?.statusCode;
                if (code === 404 || code === 410 || code === 401 || code === 403) stale.push(s.id);
              }
            }));
            if (stale.length) await supabaseAdmin.from("push_subscriptions").delete().in("id", stale);
          }

          await supabaseAdmin
            .from("pickup_requests")
            .update({ reminded_at: new Date().toISOString() })
            .eq("id", p.id);
        }

        return new Response(JSON.stringify({ reminded: (pending ?? []).length, sent }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

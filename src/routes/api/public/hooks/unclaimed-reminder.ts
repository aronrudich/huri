import { createFileRoute } from "@tanstack/react-router";
import { VALET_ROLES } from "@/lib/roles";

/** Used only if a company has no reminder setting saved. */
const DEFAULT_REMIND_MINUTES = 5;

const audienceFor = (_kind: string | null) => {
  // Parts follows the same audience as every other pickup-list submission.
  return [...VALET_ROLES, "Admin"];
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

        // Each company decides how many minutes pass before the reminder goes
        // out; 0 turns reminders off for that company entirely.
        const { data: companies } = await supabaseAdmin
          .from("dealerships")
          .select("id, reminder_minutes");
        const minutesFor = new Map<string, number>(
          (companies ?? []).map((c) => [c.id, c.reminder_minutes ?? DEFAULT_REMIND_MINUTES]),
        );

        // Customer arrivals: ding once when the card opens, 30 minutes before the ETA.
        const { notifyValetsOfArrival } = await import("@/lib/arrive.server");
        const { data: opening } = await supabaseAdmin
          .from("pickup_requests")
          .select("id, dealership_id, ro_number, customer_eta")
          .eq("status", "unclaimed")
          .is("eta_notified_at", null)
          .not("customer_eta", "is", null)
          .lte("customer_eta", new Date(Date.now() + 30 * 60_000).toISOString());
        for (const a of opening ?? []) {
          const { data: co } = await supabaseAdmin.from("dealerships").select("timezone").eq("id", a.dealership_id).maybeSingle();
          const at = new Intl.DateTimeFormat("en-US", { timeZone: co?.timezone ?? "America/Los_Angeles", hour: "numeric", minute: "2-digit" })
            .format(new Date(a.customer_eta!));
          await notifyValetsOfArrival(supabaseAdmin, a.dealership_id, {
            title: "🚗 Customer arriving soon",
            body: `${a.ro_number ? `RO #${a.ro_number} · ` : ""}Arriving ${at}`,
            url: "/pickup",
            tag: `arrival-${a.id}`,
            variant: "customer",
          });
          await supabaseAdmin.from("pickup_requests").update({ eta_notified_at: new Date().toISOString() }).eq("id", a.id);
        }

        const { data: pending, error } = await supabaseAdmin
          .from("pickup_requests")
          .select("id, dealership_id, kind, ro_number, advisor_name, customer_name, car_notes, is_staged, created_at, customer_eta")
          .eq("status", "unclaimed")
          .is("reminded_at", null);
        if (error) throw error;

        const now = Date.now();
        let sent = 0;
        for (const p of pending ?? []) {
          const minutes = minutesFor.get(p.dealership_id) ?? DEFAULT_REMIND_MINUTES;
          if (minutes <= 0) continue;
          // Upcoming arrivals count from when they open, not when submitted.
          const startedAt = p.customer_eta
            ? Math.max(new Date(p.created_at).getTime(), new Date(p.customer_eta).getTime() - 30 * 60_000)
            : new Date(p.created_at).getTime();
          if (now - startedAt < minutes * 60_000) continue;
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
              title: `⏰ Still unclaimed — ${minutes} minutes`,
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

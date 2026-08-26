import { createFileRoute } from "@tanstack/react-router";

// 14-day parked-car alerts go to the Admin role only (may widen later).
const ALERT_ROLES = ["Admin"];

/** Current hour (0-23) in Pacific time, so the digest lands at 9 AM PST/PDT. */
function pacificHour(now: Date): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    hour12: false,
  }).format(now);
  return Number(hour) % 24;
}

/** Pacific calendar date keeps each morning's digest in its own inbox thread. */
function pacificDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export const Route = createFileRoute("/api/public/hooks/stale-cars")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const acceptedKeys = [process.env["SUPABASE_PUBLISHABLE_KEY"], process.env["SUPABASE_ANON_KEY"]].filter(Boolean);
        if (!apiKey || !acceptedKeys.includes(apiKey)) return new Response("Unauthorized", { status: 401 });

        const now = new Date();
        const digestDate = pacificDate(now);
        const url = new URL(request.url);
        // The cron fires at both possible UTC hours; only the 9 AM Pacific one runs.
        if (url.searchParams.get("force") !== "1" && pacificHour(now) !== 9) {
          return Response.json({ skipped: true, reason: "not 9 AM Pacific" });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendWebPush } = await import("@/lib/push-server.server");
        const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const { data: cars, error } = await supabaseAdmin
          .from("parked_cars")
          .select("id, dealership_id, ro_number, tag_number, car_model, lot_position, notes, located_at")
          .is("stale_alerted_at", null)
          .neq("lot_position", "UNKNOWN")
          .or("lot_position.eq.BL,lot_position.eq.CP,lot_position.like.SV %")
          .lte("located_at", cutoff)
          .order("located_at", { ascending: true });
        if (error) throw error;
        if (!cars?.length) return Response.json({ processed: 0, sent: 0 });

        // One digest per dealership instead of a message per car.
        const byDealership = new Map<string, typeof cars>();
        for (const car of cars) {
          const list = byDealership.get(car.dealership_id) ?? [];
          list.push(car);
          byDealership.set(car.dealership_id, list);
        }

        let sent = 0;
        const alertedIds: string[] = [];

        for (const [dealershipId, list] of byDealership) {
          const { data: recipients } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("dealership_id", dealershipId)
            .eq("is_active", true)
            .in("role_name", ALERT_ROLES);
          const ids = (recipients ?? []).map((profile) => profile.id);
          if (!ids.length) continue;

          const lines = list.map((car) => {
            const days = Math.floor((now.getTime() - new Date(car.located_at).getTime()) / 86400000);
            return [
              car.ro_number ? `RO #${car.ro_number}` : null,
              car.tag_number ? `Tag #${car.tag_number}` : null,
              car.car_model,
              car.lot_position,
              `${days} days`,
              car.notes,
            ].filter(Boolean).join(" · ");
          });
          const messageBody = [
            `${list.length} ${list.length === 1 ? "car has" : "cars have"} been parked for 14+ days:`,
            "",
            ...lines.map((line, i) => `${i + 1}. ${line}`),
          ].join("\n");

          await supabaseAdmin.from("messages").insert(
            ids.map((id) => ({
               thread_id: `huri:${id}:${digestDate}`,
              sender_id: null,
              recipient_id: id,
              dealership_id: dealershipId,
              body: messageBody,
            })),
          );

          const { data: subscriptions } = await supabaseAdmin
            .from("push_subscriptions")
            .select("id, endpoint, p256dh, auth")
            .in("user_id", ids);
          const staleSubscriptions: string[] = [];

          // A single push per person for the whole list.
          await Promise.all((subscriptions ?? []).map(async (subscription) => {
            try {
              await sendWebPush(subscription, {
                title: `${list.length} ${list.length === 1 ? "car" : "cars"} parked 14+ days`,
                body: "Open Huri to review today's list.",
                url: "/",
                tag: "stale-car-digest",
                variant: "default",
              });
              sent += 1;
            } catch (pushError) {
              const status = (pushError as { statusCode?: number }).statusCode;
              if (status === 404 || status === 410) staleSubscriptions.push(subscription.id);
            }
          }));
          if (staleSubscriptions.length) {
            await supabaseAdmin.from("push_subscriptions").delete().in("id", staleSubscriptions);
          }

          // The inbox digest went out, so these cars are done regardless of push.
          alertedIds.push(...list.map((car) => car.id));
        }

        if (alertedIds.length) {
          await supabaseAdmin
            .from("parked_cars")
            .update({ stale_alerted_at: now.toISOString() })
            .in("id", alertedIds);
        }

        return Response.json({ processed: cars.length, alerted: alertedIds.length, sent });
      },
    },
  },
});

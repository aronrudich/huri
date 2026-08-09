import { createFileRoute } from "@tanstack/react-router";

const MANAGEMENT_ROLES = [
  "Manager",
  "Service Manager",
  "Assistant Service Manager",
  "Parts Manager",
  "Director",
  "Service Director",
  "General Manager",
  "Shop Foreman",
];

export const Route = createFileRoute("/api/public/hooks/stale-cars")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const acceptedKeys = [process.env["SUPABASE_PUBLISHABLE_KEY"], process.env["SUPABASE_ANON_KEY"]].filter(Boolean);
        if (!apiKey || !acceptedKeys.includes(apiKey)) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendWebPush } = await import("@/lib/push-server.server");
        const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const { data: cars, error } = await supabaseAdmin
          .from("parked_cars")
          .select("id, dealership_id, ro_number, tag_number, car_model, lot_position, notes, located_at")
          .is("stale_alerted_at", null)
          .neq("lot_position", "UNKNOWN")
          .or("lot_position.eq.BL,lot_position.eq.CP,lot_position.like.SV %")
          .lte("located_at", cutoff);
        if (error) throw error;

        let sent = 0;
        for (const car of cars ?? []) {
          let delivered = false;
          const { data: recipients } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("dealership_id", car.dealership_id)
            .eq("is_active", true)
            .in("role_name", MANAGEMENT_ROLES);
          const ids = (recipients ?? []).map((profile) => profile.id);
          const body = [
            car.ro_number && `RO #${car.ro_number}`,
            car.tag_number && `Tag #${car.tag_number}`,
            car.car_model,
            car.lot_position,
            car.notes,
          ].filter(Boolean).join(" · ");

          // Inbox message from Huri with the full car info.
          if (ids.length) {
            const days = Math.floor((Date.now() - new Date(car.located_at).getTime()) / 86400000);
            const messageBody = [
              `This car has been parked for ${days} days.`,
              car.ro_number ? `RO #: ${car.ro_number}` : null,
              car.tag_number ? `Tag #: ${car.tag_number}` : null,
              car.car_model ? `Car: ${car.car_model}` : null,
              `Location: ${car.lot_position}`,
              car.notes ? `Notes: ${car.notes}` : null,
              `Parked since: ${new Date(car.located_at).toLocaleString("en-US")}`,
            ].filter(Boolean).join("\n");
            await supabaseAdmin.from("messages").insert(
              ids.map((id) => ({
                thread_id: `huri:${id}`,
                sender_id: null,
                recipient_id: id,
                dealership_id: car.dealership_id,
                body: messageBody,
              })),
            );
          }

          if (ids.length) {
            const { data: subscriptions } = await supabaseAdmin
              .from("push_subscriptions")
              .select("id, endpoint, p256dh, auth")
              .in("user_id", ids);
            const staleSubscriptions: string[] = [];


            await Promise.all((subscriptions ?? []).map(async (subscription) => {
              try {
                await sendWebPush(subscription, {
                  title: "Car parked for 14 days",
                  body: body || "Open Huri to review this vehicle.",
                  url: `/park?id=${car.id}`,
                  tag: `stale-car-${car.id}`,
                  variant: "default",
                });
                sent += 1;
                delivered = true;
              } catch (pushError) {
                const status = (pushError as { statusCode?: number }).statusCode;
                if (status === 404 || status === 410) staleSubscriptions.push(subscription.id);
              }
            }));
            if (staleSubscriptions.length) {
              await supabaseAdmin.from("push_subscriptions").delete().in("id", staleSubscriptions);
            }
          }
          if (delivered) {
            await supabaseAdmin.from("parked_cars").update({ stale_alerted_at: new Date().toISOString() }).eq("id", car.id);
          }
        }

        return Response.json({ processed: cars?.length ?? 0, sent });
      },
    },
  },
});
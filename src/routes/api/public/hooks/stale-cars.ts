import { createFileRoute } from "@tanstack/react-router";

/** Current hour (0-23) in Pacific time, so the refresh lands at 5 AM PST/PDT. */
function pacificHour(now: Date): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    hour12: false,
  }).format(now);
  return Number(hour) % 24;
}

export const Route = createFileRoute("/api/public/hooks/stale-cars")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Authenticated with a private scheduler token — never the publishable app key,
        // which ships in the browser bundle.
        const provided = request.headers.get("x-cron-secret");
        const expected = process.env["CRON_WEBHOOK_TOKEN"] ?? process.env["CRON_WEBHOOK_SECRET"];
        if (!expected || provided !== expected) return new Response("Unauthorized", { status: 401 });

        const now = new Date();
        const url = new URL(request.url);
        // The cron fires at both possible UTC hours; only the 5 AM Pacific one runs.
        if (url.searchParams.get("force") !== "1" && pacificHour(now) !== 5) {
          return Response.json({ skipped: true, reason: "not 5 AM Pacific" });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

        // Every location counts — nothing is excluded from the Flagged Cars list.
        // Cars a manager swiped off the list stay off until they move again.
        const { data: candidates, error } = await supabaseAdmin
          .from("parked_cars")
          .select("id, ro_number, located_at")
          .is("flagged_at", null)
          .is("flag_dismissed_at", null)
          .lte("located_at", cutoff);
        if (error) throw error;

        // A blue (customer) pickup that was claimed and cleared means the customer
        // drove the car home — those cars never belong on the 14-day list. Red
        // technician pickups stay eligible; the car is still on the property.
        const ros = [...new Set((candidates ?? []).map((c) => c.ro_number).filter(Boolean) as string[])];
        const pickedUp = new Map<string, number>();
        for (let i = 0; i < ros.length; i += 200) {
          const { data: reqs, error: reqErr } = await supabaseAdmin
            .from("pickup_requests")
            .select("ro_number, claimed_at, completed_at")
            .in("ro_number", ros.slice(i, i + 200))
            .eq("kind", "pickup")
            .eq("is_staged", false)
            .eq("status", "completed")
            .not("source_role", "in", '("Technician","Shop Foreman")');
          if (reqErr) throw reqErr;
          (reqs ?? []).forEach((r) => {
            const at = new Date(r.completed_at ?? r.claimed_at ?? 0).getTime();
            const ro = (r.ro_number ?? "").trim();
            if (ro && at > (pickedUp.get(ro) ?? 0)) pickedUp.set(ro, at);
          });
        }

        const ids = (candidates ?? [])
          .filter((c) => {
            const at = pickedUp.get((c.ro_number ?? "").trim());
            if (!at) return true;
            return at < new Date(c.located_at ?? 0).getTime();
          })
          .map((c) => c.id);

        if (ids.length) {
          const { error: upErr } = await supabaseAdmin
            .from("parked_cars")
            .update({ flagged_at: now.toISOString() })
            .in("id", ids);
          if (upErr) throw upErr;
        }

        return Response.json({ flagged: ids.length });

      },
    },
  },
});

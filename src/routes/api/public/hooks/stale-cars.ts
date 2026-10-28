import { createFileRoute } from "@tanstack/react-router";
import { loadAllCarPages } from "@/lib/car-loading";
import { companyRoKey } from "@/lib/tenant-events";

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
        // Each company sets its own number of untouched days. We query with the
        // widest window, then apply every company's own number row by row.
        const companies = await loadAllCarPages((from, to) => supabaseAdmin
          .from("dealerships")
          .select("id, flagged_days").order("id").range(from, to));
        const daysFor = new Map<string, number>(
          (companies ?? []).map((c) => [c.id, c.flagged_days ?? 14]),
        );
        // Query with the shortest configured window so every company's own number is reachable.
        const shortestDays = daysFor.size ? Math.min(...daysFor.values()) : 14;
        const cutoff = new Date(now.getTime() - shortestDays * 24 * 60 * 60 * 1000).toISOString();

        // Every location counts — nothing is excluded from the Flagged Cars list.
        // Cars a manager swiped off the list stay off until they move again.
        const candidates = await loadAllCarPages((from, to) => supabaseAdmin
          .from("parked_cars")
          .select("id, ro_number, located_at, dealership_id")
          .neq("lot_position", "TAKEN")
          .is("flagged_at", null)
          .is("flag_dismissed_at", null)
          .lte("located_at", cutoff).order("id").range(from, to));

        // A blue (customer) pickup that was claimed and cleared means the customer
        // drove the car home — those cars never belong on the flagged list. Red
        // technician pickups stay eligible; the car is still on the property.
        const ros = [...new Set((candidates ?? []).map((c) => c.ro_number).filter(Boolean) as string[])];
        const pickedUp = new Map<string, number>();
        for (let i = 0; i < ros.length; i += 200) {
          const reqs = await loadAllCarPages((from, to) => supabaseAdmin
            .from("pickup_requests")
            .select("ro_number, claimed_at, completed_at, dealership_id")
            .in("ro_number", ros.slice(i, i + 200))
            .eq("kind", "pickup")
            .eq("is_staged", false)
            .in("status", ["completed", "picked_up"])
            .not("source_role", "in", '("Technician","Shop Foreman")')
            .order("id").range(from, to));
          (reqs ?? []).forEach((r) => {
            const at = new Date(r.completed_at ?? r.claimed_at ?? 0).getTime();
            const key = companyRoKey(r.dealership_id, r.ro_number);
            if (r.ro_number && at > (pickedUp.get(key) ?? 0)) pickedUp.set(key, at);
          });
        }

        const ids = (candidates ?? [])
          .filter((c) => {
            const days = daysFor.get(c.dealership_id) ?? 14;
            const age = now.getTime() - new Date(c.located_at ?? 0).getTime();
            if (age < days * 24 * 60 * 60 * 1000) return false;
            const at = pickedUp.get(companyRoKey(c.dealership_id, c.ro_number));
            if (!at) return true;
            return at < new Date(c.located_at ?? 0).getTime();
          })
          .map((c) => c.id);

        for (const candidate of candidates.filter((c) => ids.includes(c.id))) {
          const { error: upErr } = await supabaseAdmin
            .from("parked_cars")
            .update({ flagged_at: now.toISOString() })
            .eq("id", candidate.id).eq("located_at", candidate.located_at)
            .neq("lot_position", "TAKEN").is("flagged_at", null).is("flag_dismissed_at", null);
          if (upErr) throw upErr;
        }

        return Response.json({ flagged: ids.length });

      },
    },
  },
});

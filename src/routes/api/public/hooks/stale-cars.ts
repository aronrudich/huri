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
        const { data, error } = await supabaseAdmin
          .from("parked_cars")
          .update({ flagged_at: now.toISOString() })
          .is("flagged_at", null)
          .is("flag_dismissed_at", null)
          .lte("located_at", cutoff)
          .select("id");
        if (error) throw error;

        return Response.json({ flagged: data?.length ?? 0 });
      },
    },
  },
});

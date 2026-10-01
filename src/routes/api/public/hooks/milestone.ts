import { createFileRoute } from "@tanstack/react-router";

/** One-time push for the Alex 1,000-claims celebration. Called by the database trigger. */
export const Route = createFileRoute("/api/public/hooks/milestone")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-cron-secret");
        const expected = process.env["CRON_WEBHOOK_TOKEN"] ?? process.env["CRON_WEBHOOK_SECRET"];
        if (!expected || provided !== expected) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendWebPush } = await import("@/lib/push-server.server");

        const { data: msgs } = await supabaseAdmin
          .from("messages")
          .select("recipient_id, thread_id, body")
          .like("thread_id", "huri:milestone-alex-1000:%");
        const rows = (msgs ?? []).filter((m) => m.recipient_id);
        if (!rows.length) return Response.json({ sent: 0 });

        const threadFor = new Map(rows.map((m) => [m.recipient_id as string, m.thread_id]));
        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("user_id, endpoint, p256dh, auth")
          .in("user_id", [...threadFor.keys()]);

        const body = "WOW! Alex has officially hit 1000 claims! He sure knows to Huri the f*ck up! Thank you Alex!";
        let sent = 0;
        await Promise.all(
          (subs ?? []).map(async (s) => {
            try {
              await sendWebPush(s, {
                title: "🏆 Huri",
                body,
                tag: "milestone-alex-1000",
                url: `/thread/${encodeURIComponent(threadFor.get(s.user_id) ?? "")}`,
              });
              sent++;
            } catch {
              /* ignore bad subscriptions */
            }
          }),
        );
        return Response.json({ sent });
      },
    },
  },
});

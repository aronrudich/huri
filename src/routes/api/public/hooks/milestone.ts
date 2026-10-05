import { createFileRoute } from "@tanstack/react-router";

/** One-time push for the Alex 1,000-claims celebration. Called by the database trigger. */
export const Route = createFileRoute("/api/public/hooks/milestone")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        void request;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // No shared secret: the push can only go out once, and only after the
        // database has actually recorded the milestone.
        const { data: claimed } = await supabaseAdmin.rpc("claim_milestone_push" as never, { _key: "alex-1000" } as never);
        if (claimed !== true) return Response.json({ sent: 0 });
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

        const body = "WOW! Alex has officially hit 1000 claims! He sure knows how to Huri up! Thank you Alex!";
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

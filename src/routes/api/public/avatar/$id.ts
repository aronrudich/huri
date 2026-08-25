import { createFileRoute } from "@tanstack/react-router";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Serves an employee's profile photo as a real cacheable image instead of
 * shipping base64 image data inside every directory/roster response.
 *
 * The URL carries a `?v=` stamp derived from the photo itself, so a changed
 * photo gets a new URL and the browser can cache each image aggressively.
 */
export const Route = createFileRoute("/api/public/avatar/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = params.id;
        if (!UUID.test(id)) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("profiles")
          .select("avatar_url")
          .eq("id", id)
          .maybeSingle();

        const url = data?.avatar_url ?? null;
        if (!url) return new Response("Not found", { status: 404 });

        // Photos are stored as `data:image/jpeg;base64,...` on the profile row.
        const match = /^data:([^;,]+);base64,(.*)$/s.exec(url);
        if (!match) {
          // Already an external URL — hand the client straight to it.
          return new Response(null, { status: 302, headers: { Location: url } });
        }

        const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
        return new Response(bytes, {
          headers: {
            "Content-Type": match[1],
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});

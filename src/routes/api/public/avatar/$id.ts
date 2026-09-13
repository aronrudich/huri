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
        const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.*)$/s.exec(url);
        if (!match) {
          // Anything that isn't an inline image we control is not served or
          // redirected to — an arbitrary avatar_url must never become a redirect.
          return new Response("Not found", { status: 404 });
        }

        const decoded = (() => {
          try {
            return Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
          } catch {
            return null;
          }
        })();
        if (!decoded) return new Response("Not found", { status: 404 });
        const bytes = decoded.slice().buffer;
        return new Response(bytes, {
          headers: {
            "Content-Type": match[1],
            // Employee photos are not public content: only the requesting
            // browser may cache them, never a shared/CDN cache.
            "Cache-Control": "private, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});

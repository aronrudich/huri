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
      GET: async ({ params, request }) => {
        const id = params.id;
        if (!UUID.test(id)) return new Response("Not found", { status: 404 });

        // Only signed-in coworkers at the same company may see a photo.
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
        const { data: viewer } = await supabaseAdmin
          .from("profiles")
          .select("dealership_id, is_active, status")
          .eq("id", userData.user.id)
          .maybeSingle();
        if (!viewer?.dealership_id || !viewer.is_active || viewer.status !== "approved") {
          return new Response("Not found", { status: 404 });
        }

        const { data } = await supabaseAdmin
          .from("profiles")
          .select("avatar_url")
          .eq("id", id)
          .eq("dealership_id", viewer.dealership_id)
          .maybeSingle();

        const url = data?.avatar_url ?? null;
        if (!url) return new Response("Not found", { status: 404 });

        // Photos are stored as `data:image/jpeg;base64,...` on the profile row.
        const match = /^data:([^;,]+);base64,(.*)$/s.exec(url);
        // Only stored image data is served; never redirect to arbitrary URLs.
        if (!match || !/^image\/(png|jpeg|webp|gif|heic)$/i.test(match[1])) {
          return new Response("Not found", { status: 404 });
        }

        const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
        return new Response(bytes, {
          headers: {
            "Content-Type": match[1],
            "Cache-Control": "private, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});

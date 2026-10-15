import { createFileRoute } from "@tanstack/react-router";
import { BUILD_ID } from "@/lib/build-id";

// Public, non-sensitive: only the build timestamp, so open apps can tell
// when a newer version has been published.
export const Route = createFileRoute("/api/public/version")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ id: BUILD_ID }), {
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store, max-age=0",
          },
        }),
    },
  },
});

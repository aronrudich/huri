import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Huri opens on the pickup list. The inbox lives at /inbox and is reachable
 * from the bottom bar, so "/" just forwards to the queue.
 */
export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Huri · Vehicle Pickup Queue" },
    { name: "description", content: "Open Huri to manage vehicle pickups and company lot activity." },
    { property: "og:title", content: "Huri · Vehicle Pickup Queue" },
    { property: "og:description", content: "Open Huri to manage vehicle pickups and company lot activity." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: () => {
    throw redirect({ to: "/pickup", replace: true });
  },
});

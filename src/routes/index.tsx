import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Huri opens on the pickup list. The inbox lives at /inbox and is reachable
 * from the bottom bar, so "/" just forwards to the queue.
 */
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/pickup", replace: true });
  },
});

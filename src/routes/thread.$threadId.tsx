import { createFileRoute, redirect } from "@tanstack/react-router";

// Messaging was retired; old thread links land on the pickup list.
export const Route = createFileRoute("/thread/$threadId")({
  beforeLoad: () => {
    throw redirect({ to: "/pickup", replace: true });
  },
});

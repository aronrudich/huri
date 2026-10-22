import { createFileRoute, redirect } from "@tanstack/react-router";

// Messaging was retired; old inbox links land on the pickup list.
export const Route = createFileRoute("/inbox")({
  beforeLoad: () => {
    throw redirect({ to: "/pickup", replace: true });
  },
});

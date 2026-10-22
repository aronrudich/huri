import { createFileRoute, redirect } from "@tanstack/react-router";

// Messaging was retired; old compose links land on the pickup list.
export const Route = createFileRoute("/compose")({
  beforeLoad: () => {
    throw redirect({ to: "/pickup", replace: true });
  },
});

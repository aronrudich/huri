import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

/**
 * "/" decides where to go only after we know whether someone is signed in,
 * so signed-out visitors never glimpse the pickup screen on the way to sign-in.
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
  component: IndexComponent,
});

function hasStoredSession() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && /^sb-.*-auth-token$/.test(k) && localStorage.getItem(k)) return true;
    }
  } catch { /* storage blocked */ }
  return false;
}

function IndexComponent() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user) return void navigate({ to: "/pickup", replace: true });
    if (!hasStoredSession() || !loading) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  return <div className="min-h-screen bg-surface" />;
}

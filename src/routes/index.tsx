import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { DemoFeed } from "@/components/DemoFeed";

/**
 * "/" decides where to go only after we know whether someone is signed in,
 * so signed-out visitors never glimpse the pickup screen on the way to sign-in.
 */
export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Huri · Vehicle Pickup Queue" },
    { name: "description", content: "Watch a live simulated service drive: Huri keeps vehicle pickups moving." },
    { property: "og:title", content: "Huri · Vehicle Pickup Queue" },
    { property: "og:description", content: "Watch a live simulated service drive: Huri keeps vehicle pickups moving." },
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
  }, [user, navigate]);

  // Signed-in visitors (or a stored session still restoring) never see the demo.
  const [checked, setChecked] = useState(false);
  const [stored, setStored] = useState(false);
  useEffect(() => { setStored(hasStoredSession()); setChecked(true); }, []);
  if (user || !checked || (stored && loading)) return <div className="min-h-screen bg-surface" />;
  return <DemoFeed />;
}

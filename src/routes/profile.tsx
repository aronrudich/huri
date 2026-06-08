import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Bell, BellOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BottomBar } from "@/components/BottomBar";
import { subscribePush } from "@/lib/push";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile · Huri" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) setPerm(Notification.permission);
    else setPerm("unsupported");
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const enableNotifs = async () => {
    if (!user) return;
    const r = await subscribePush(user.id);
    if (r === "ok") { toast.success("Notifications enabled"); setPerm("granted"); }
    else if (r === "denied") toast.error("Notification permission denied");
    else if (r === "no-key") toast.error("Push not configured yet (VAPID key missing)");
    else toast.error("Push not supported on this device");
  };

  return (
    <div className="min-h-screen bg-surface pb-32 safe-top">
      <header className="px-5 pb-3 pt-4">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
      </header>

      {profile && (
        <section className="mx-3 overflow-hidden rounded-2xl bg-background">
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-xl font-bold text-primary">
              {(profile.nickname || profile.full_name)[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-semibold">{profile.full_name}</p>
              {profile.nickname && <p className="text-xs text-muted-foreground">"{profile.nickname}"</p>}
              <p className="text-sm text-primary">{profile.role_name}</p>
            </div>
          </div>
          <Row label="Email" value={profile.email} />
          <Row label="Phone" value={profile.phone ?? "—"} />
        </section>
      )}

      <section className="mx-3 mt-4 overflow-hidden rounded-2xl bg-background">
        <button onClick={enableNotifs} className="flex w-full items-center gap-3 px-4 py-4 active:bg-accent">
          {perm === "granted" ? <Bell className="h-5 w-5 text-success" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
          <div className="flex-1 text-left">
            <p className="font-medium">Push notifications</p>
            <p className="text-xs text-muted-foreground">
              {perm === "granted" ? "Enabled on this device" : perm === "unsupported" ? "Not supported on this device" : "Tap to enable"}
            </p>
          </div>
        </button>
      </section>

      <section className="mx-3 mt-4 overflow-hidden rounded-2xl bg-background">
        <button onClick={logout} className="flex w-full items-center gap-3 px-4 py-4 text-destructive active:bg-accent">
          <LogOut className="h-5 w-5" />
          <span className="font-medium">Log out</span>
        </button>
      </section>

      <p className="mt-6 px-5 text-center text-xs text-muted-foreground">
        Install Huri: open this page in Safari/Chrome → Share → Add to Home Screen.
      </p>

      <BottomBar active="profile" />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

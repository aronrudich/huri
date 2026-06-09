import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { subscribePush } from "@/lib/push";
import { toast } from "sonner";

/**
 * First-login gate: forces the user to grant Notification permission before they
 * can use Huri. Skipped on devices that don't support web push.
 */
export function NotificationGate() {
  const { user } = useAuth();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) { setPerm("unsupported"); return; }
    setPerm(Notification.permission);
  }, [user]);

  if (!user) return null;
  if (perm !== "default") return null; // granted, denied, or unsupported → no block

  const enable = async () => {
    setBusy(true);
    const r = await subscribePush(user.id);
    setBusy(false);
    if (r === "ok") { toast.success("Notifications enabled"); setPerm("granted"); return; }
    if (r === "denied") { toast.error("Permission denied. Enable in browser settings to use Huri."); setPerm("denied"); return; }
    if (r === "no-key") { toast.message("Push setup pending — continuing without."); setPerm("granted"); return; }
    setPerm("unsupported");
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-background p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Bell className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-semibold">Turn on notifications</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Huri needs to alert you the moment a pickup request comes in or a teammate messages you — even when your phone is locked.
        </p>
        <button
          onClick={enable}
          disabled={busy}
          className="mt-5 w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Requesting…" : "Allow Notifications"}
        </button>
        <p className="mt-3 text-[11px] text-muted-foreground">Required to continue.</p>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { requestNotifPermission, registerPushSubscription, setNotifPref } from "@/lib/push";
import { toast } from "sonner";

/**
 * First-login gate: forces the user to grant Notification permission before they
 * can use Huri. Skipped on devices that don't support web push.
 */
export function NotificationGate() {
  const { user } = useAuth();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported" | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem("huri.notifications.gate.dismissed") === "yes") {
      setDismissed(true);
    }
    const supported =
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    if (!supported) { setPerm("unsupported"); return; }
    setPerm(Notification.permission);
  }, [user]);

  if (!user) return null;
  if (dismissed) return null;
  if (perm !== "default") return null;

  const enable = async () => {
    setBusy(true);
    // Direct, synchronous-from-click call so the browser prompt actually shows.
    const result = await requestNotifPermission();
    setBusy(false);
    if (result === "granted") {
      setNotifPref(true);
      setPerm("granted");
      toast.success("Notifications enabled");
      // Subscribe in the background — switch already flipped.
      void registerPushSubscription(user.id);
      return;
    }
    if (result === "denied") {
      toast.error("Permission denied. You can enable later from Profile.");
      setPerm("denied");
      return;
    }
    toast.message("You can turn on notifications later from Profile.");
  };

  const skip = () => {
    window.localStorage.setItem("huri.notifications.gate.dismissed", "yes");
    setDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-background p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Bell className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-semibold">Turn on notifications</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Huri will alert you the moment a pickup request comes in or a teammate messages you — even when this tab is in the background.
        </p>
        <button
          onClick={enable}
          disabled={busy}
          className="mt-5 w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Requesting…" : "Allow Notifications"}
        </button>
        <button onClick={skip} className="mt-3 text-sm font-medium text-muted-foreground">
          Not now
        </button>
      </div>
    </div>
  );
}

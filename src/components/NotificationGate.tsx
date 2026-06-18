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
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem("huri.notifications.gate.dismissed") === "yes") {
      setDismissed(true);
    }
    if (!window.matchMedia("(hover: none) and (pointer: coarse)").matches) {
      setPerm("unsupported");
      return;
    }
    if (!("Notification" in window)) { setPerm("unsupported"); return; }
    setPerm(Notification.permission);
  }, [user]);

  if (!user) return null;
  if (dismissed) return null;
  if (perm !== "default") return null; // granted, denied, or unsupported → no block

  const enable = async () => {
    setBusy(true);
    try {
      const r = await Promise.race<"ok" | "denied" | "unsupported">([
        subscribePush(user.id),
        new Promise((resolve) => window.setTimeout(() => resolve("unsupported"), 8000)),
      ]);
      if (r === "ok") { toast.success("Notifications enabled"); setPerm("granted"); return; }
      if (r === "denied") { toast.error("Permission denied. You can turn them on later from Profile."); setPerm("denied"); return; }
      toast.message("You can turn on notifications later from Profile.");
      setPerm("unsupported");
    } finally {
      setBusy(false);
    }
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
          Huri needs to alert you the moment a pickup request comes in or a teammate messages you — even when your phone is locked.
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

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

/**
 * iOS Safari only delivers Web Push when the site is installed to the Home Screen
 * and launched from the icon (PWA standalone mode). Show a one-time hint to iOS
 * users in a regular Safari tab so they know how to enable real notifications.
 */
const KEY = "huri.ios-install-hint.dismissed";

export function IOSInstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
    const standalone =
      (window.matchMedia?.("(display-mode: standalone)").matches) ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isIOS && !standalone && localStorage.getItem(KEY) !== "1") {
      setShow(true);
    }
  }, []);

  if (!show) return null;
  const dismiss = () => { localStorage.setItem(KEY, "1"); setShow(false); };

  return (
    <div className="fixed inset-x-3 bottom-24 z-40 rounded-2xl border border-border bg-background p-4 shadow-2xl">
      <button onClick={dismiss} aria-label="Dismiss"
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-muted-foreground">
        <X className="h-4 w-4" />
      </button>
      <p className="pr-6 text-sm font-semibold">Install Huri for lock-screen alerts</p>
      <p className="mt-1 pr-6 text-xs text-muted-foreground">
        On iPhone, tap <Share className="inline h-3.5 w-3.5 align-text-bottom" /> Share → "Add to Home Screen", then open Huri from the icon. Notifications only work in the installed app.
      </p>
    </div>
  );
}

import { useEffect } from "react";
import { BUILD_ID } from "@/lib/build-id";

/**
 * Home-screen apps on iPhone keep the old app in memory for days, so fixes we
 * publish never reach them. When Huri comes back to the front (and every few
 * minutes while open) it asks the server which build is live; if it's newer,
 * the app reloads itself — but never while someone is typing or has a sheet,
 * photo or camera open.
 */
const CHECK_EVERY_MS = 5 * 60_000;
const BUSY_RETRY_MS = 15_000;
const FORM_PATHS = ["/pickup-new", "/park-request", "/compose", "/thread/", "/park", "/parts", "/wash", "/bring-me", "/auth", "/reset-password", "/business-onboarding"];
const RELOADED_KEY = "huri.update.reloaded-for";

function isPreviewHost() {
  const h = location.hostname;
  return h === "localhost" || h.startsWith("id-preview--") || h.startsWith("preview--") ||
    h.endsWith("lovableproject.com") || h.endsWith("lovableproject-dev.com") || window.self !== window.top;
}

function isBusy() {
  const p = location.pathname;
  if (FORM_PATHS.some((f) => p.startsWith(f))) return true;
  const el = document.activeElement as HTMLElement | null;
  if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return true;
  if (document.querySelector('[role="dialog"], [data-state="open"][role="alertdialog"], video')) return true;
  return false;
}

async function liveBuildId(): Promise<string | null> {
  try {
    const res = await fetch(`/api/public/version?ts=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string };
    return typeof data.id === "string" ? data.id : null;
  } catch {
    return null;
  }
}

export function useAppUpdate() {
  useEffect(() => {
    if (!import.meta.env.PROD || BUILD_ID === "dev" || isPreviewHost()) return;

    let pendingId: string | null = null;
    let busyTimer: ReturnType<typeof setTimeout> | undefined;
    let checking = false;

    const reloadWhenIdle = () => {
      clearTimeout(busyTimer);
      if (!pendingId) return;
      if (document.visibilityState !== "visible" || isBusy()) {
        busyTimer = setTimeout(reloadWhenIdle, BUSY_RETRY_MS);
        return;
      }
      // Never loop: reload at most once per newer build.
      try {
        if (sessionStorage.getItem(RELOADED_KEY) === pendingId) return;
        sessionStorage.setItem(RELOADED_KEY, pendingId);
      } catch { /* storage unavailable */ }
      location.reload();
    };

    const check = async () => {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      const id = await liveBuildId();
      checking = false;
      if (id && id !== BUILD_ID) {
        pendingId = id;
        reloadWhenIdle();
      }
    };

    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    const onShow = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onShow);
    window.addEventListener("focus", onShow);
    const interval = setInterval(() => void check(), CHECK_EVERY_MS);
    void check();

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("focus", onShow);
      clearInterval(interval);
      clearTimeout(busyTimer);
    };
  }, []);
}

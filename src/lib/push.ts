import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? "";
const PREF_KEY = "huri.notifications.enabled";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function getNotifPref(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PREF_KEY) !== "off";
}

export function setNotifPref(on: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREF_KEY, on ? "on" : "off");
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch (e) {
    console.warn("SW register failed", e);
    return null;
  }
}

/**
 * Step 1: request browser permission. MUST be called directly from a user
 * gesture (click) — no awaits before this line in the handler.
 */
export async function requestNotifPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

/**
 * Step 2: register the SW push subscription and store it server-side.
 * Safe to call after `requestNotifPermission()` returns "granted".
 */
export async function registerPushSubscription(userId: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!VAPID_PUBLIC) { console.warn("VITE_VAPID_PUBLIC_KEY missing"); return false; }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const reg = await ensureServiceWorker();
    if (!reg) return false;
    // Wait for SW activation so pushManager.subscribe doesn't race.
    if (!reg.active) await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const key = urlBase64ToUint8Array(VAPID_PUBLIC);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
      });
    }
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
      await supabase.from("push_subscriptions").upsert(
        { user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
        { onConflict: "endpoint" },
      );
      return true;
    }
    return false;
  } catch (e) {
    console.warn("registerPushSubscription failed", e);
    return false;
  }
}

/**
 * Back-compat wrapper used by older call sites. Prefer the split functions above.
 */
export async function subscribePush(userId: string): Promise<"ok" | "denied" | "unsupported"> {
  const perm = await requestNotifPermission();
  if (perm === "unsupported") return "unsupported";
  if (perm !== "granted") return "denied";
  setNotifPref(true);
  // Fire-and-forget; permission alone is enough for the switch to flip.
  void registerPushSubscription(userId);
  return "ok";
}

/**
 * Fire a local notification. Prefer the active SW registration so banners
 * appear even when the tab is focused (desktop Chrome quirk).
 */
export async function notify(title: string, body: string, url = "/") {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!getNotifPref()) return;
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, {
          body,
          icon: "/icon-512.png",
          badge: "/icon-512.png",
          data: { url },
        });
        return;
      }
    }
    new Notification(title, { body, icon: "/icon-512.png", data: { url } });
  } catch (e) {
    console.warn("notify failed", e);
  }
}

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
 * Request browser notification permission. If a VAPID key is configured, also
 * register a Web Push subscription so the server can wake the device. Without
 * VAPID we still return "ok" — in-app `new Notification()` calls work fine for
 * the live demo as long as permission is granted.
 */
export async function subscribePush(userId: string): Promise<"ok" | "denied" | "unsupported"> {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window)) return "unsupported";

  const perm = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (perm !== "granted") return "denied";

  setNotifPref(true);

  // Best-effort Web Push subscription (only if VAPID + SW + PushManager available)
  if (VAPID_PUBLIC && "serviceWorker" in navigator && "PushManager" in window) {
    try {
      const reg = await ensureServiceWorker();
      if (reg) {
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
        }
      }
    } catch (e) {
      console.warn("Push subscribe failed (non-fatal)", e);
    }
  }

  return "ok";
}

/** Fire an in-app notification if the user hasn't turned them off. */
export function notify(title: string, body: string, url = "/") {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!getNotifPref()) return;
  try {
    new Notification(title, { body, icon: "/icon-512.png", data: { url } });
  } catch (e) {
    console.warn("notify failed", e);
  }
}

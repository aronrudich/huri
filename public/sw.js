// Huri Service Worker — push notifications only (no app-shell cache)
// v3 — always uses server-provided title/body; falls back to descriptive text.
const SW_VERSION = "huri-sw-v3";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Huri",
    body: "You have a new notification",
    url: "/",
  };
  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch (_) {
      try {
        const text = event.data.text();
        if (text) payload.body = text;
      } catch (_) {}
    }
  }
  const title = payload.title || "Huri";
  const options = {
    body: payload.body || "Tap to open Huri",
    icon: "/icon-512.png",
    badge: "/icon-512.png",
    data: { url: payload.url || "/" },
    vibrate: [300, 120, 300, 120, 300],
    tag: payload.tag,
    renotify: true,
    requireInteraction: true,
    silent: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = all.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })(),
  );
});

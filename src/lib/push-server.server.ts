// Server-only VAPID config + web-push sender. Imported only by *.functions.ts handlers.
// NOTE: For this demo the VAPID private key is inlined. Rotate before shipping by moving
// to env vars (VAPID_PRIVATE_KEY) and reading process.env here.
import webpush from "web-push";

export const VAPID_PUBLIC =
  "BPm-zOSUh5edeSjmUuo5SKDd6fmdxidekZCItK-t4TA9a_KBXsRBk8F9msZOBCXujIFsPYqxge7S2UtKP0puGb8";
const VAPID_PRIVATE =
  process.env.VAPID_PRIVATE_KEY ?? "8q4WSdwWgB8OjlGzfeV2G5Js74d18WpN4e0FwuAk-Is";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:demo@huri.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

export type PushSub = { endpoint: string; p256dh: string; auth: string };

export async function sendWebPush(sub: PushSub, payload: object) {
  return webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payload),
    { TTL: 60 },
  );
}

// Server-only VAPID config + web-push sender. Imported only by *.functions.ts handlers.
// Keys live in backend secrets (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY); nothing is hardcoded.
import webpush from "web-push";

const publicKey = process.env["VAPID_PUBLIC_KEY"] ?? process.env["VITE_VAPID_PUBLIC_KEY"];
const privateKey = process.env["VAPID_PRIVATE_KEY"];
const subject = process.env["VAPID_SUBJECT"] ?? "mailto:notifications@huri.app";

if (!publicKey || !privateKey) {
  throw new Error(
    "Push notifications are not configured: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set.",
  );
}

export const VAPID_PUBLIC = publicKey;

webpush.setVapidDetails(subject, publicKey, privateKey);

export type PushSub = { endpoint: string; p256dh: string; auth: string };

/** Endpoints rejected with these codes will never work again — prune them. */
export const isStalePushStatus = (status: number | undefined) =>
  status === 404 || status === 410 || status === 401 || status === 403;

export async function sendWebPush(sub: PushSub, payload: object) {
  return webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payload),
    {
      TTL: 3600,
      urgency: "high", // iOS/APNs: deliver immediately with alert + sound
      headers: { Urgency: "high" },
    },
  );
}

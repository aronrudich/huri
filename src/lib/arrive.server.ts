import { sendWebPush, isStalePushStatus, isBadSubscriptionStatus } from "./push-server.server";

/** Roles that get the ding when a customer sets an arrival time. */
const RECIPIENT_ROLES = ["Valet", "Admin"];

/** Milliseconds between UTC and the company's own clock at a given moment. */
export function timezoneOffsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const hour = get("hour") === 24 ? 0 : get("hour");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  return asUtc - at.getTime();
}

/**
 * Turns a customer's "3:45 PM" into a real moment on the company's clock.
 * A time that already passed (more than 5 minutes ago) means tomorrow.
 */
export function resolveEta(timeZone: string, hour12: number, minute: number, meridiem: "AM" | "PM"): Date {
  const now = new Date();
  const offset = timezoneOffsetMs(timeZone, now);
  const local = new Date(now.getTime() + offset);
  let hour = hour12 % 12;
  if (meridiem === "PM") hour += 12;

  const build = (dayShift: number) => {
    const guess = Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() + dayShift,
      hour,
      minute,
    );
    // Re-read the offset at the target moment so DST changes stay correct.
    const target = new Date(guess - offset);
    return new Date(guess - timezoneOffsetMs(timeZone, target));
  };

  const today = build(0);
  if (today.getTime() > now.getTime() - 5 * 60_000) return today;
  return build(1);
}

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** Pushes the arrival alert to every valet at that company. */
export async function notifyValetsOfArrival(
  admin: AdminClient,
  dealershipId: string,
  payload: { title: string; body: string; url: string; tag: string; variant: string },
) {
  const { data: recipients, error: recipientsError } = await admin
    .from("profiles")
    .select("id")
    .eq("dealership_id", dealershipId)
    .eq("is_active", true)
    .eq("status", "approved")
    .eq("notifications_enabled", true)
    .in("role_name", RECIPIENT_ROLES);
  if (recipientsError || !recipients?.length) return;

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", recipients.map((r) => r.id));
  if (!subs?.length) return;

  const stale: string[] = [];
  await Promise.all(subs.map(async (sub) => {
    try {
      await sendWebPush({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload);
    } catch (error: unknown) {
      const status = (error as { statusCode?: number })?.statusCode;
      if (isStalePushStatus(status) || isBadSubscriptionStatus(status)) stale.push(sub.id);
      else console.error("arrival notification failed", status, (error as Error)?.message);
    }
  }));
  if (stale.length) await admin.from("push_subscriptions").delete().in("id", stale);
}

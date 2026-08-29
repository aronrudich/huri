import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sendWebPush } from "./push-server.server";

export type PickupSubmission = {
  tag?: string | null;
  ro?: string | null;
  advisor?: string | null;
  model?: string | null;
  notes?: string | null;
  sourceRole?: string | null;
  kind?: "pickup" | "park" | "wash" | "parts";
  staged?: boolean | null;
  lotPosition?: string | null;
};

export type PickupDeliveryResult = {
  pickupId: string;
  recipients: number;
  devices: number;
  sent: number;
  pruned: number;
  failed: number;
};

const PARTS_ROLES = [
  "Technician", "Shop Foreman", "Manager", "Assistant Service Manager",
  "Parts Manager", "Director", "Admin", "Service Manager", "Service Director", "General Manager",
];

const RECIPIENT_ROLES = ["Valet", "Valet & Shuttle", "Admin"];

function payloadFor(data: PickupSubmission, pickupId: string) {
  const isTech = data.sourceRole === "Technician" || data.sourceRole === "Shop Foreman";
  const isParts = data.kind === "parts";
  const isPark = data.kind === "park";
  const isWash = data.kind === "wash";
  const isStaged = !!data.staged;
  const body = [
    data.ro && `RO #${data.ro}`,
    data.tag && `Tag #${data.tag}`,
    data.advisor,
    data.model,
    data.notes,
  ].filter(Boolean).join(" · ") || "Open Huri";

  return {
    title: isParts
      ? "🚨 Parts request"
      : isStaged
        ? "🏁 Car staged — bring to CP"
        : isWash
          ? "🧼 Wash request — bring car to wash"
          : isPark
            ? "🅿️ Park request — come to the bay"
            : isTech ? "🚨 Tech pickup request" : "New pickup request",
    body,
    url: "/pickup",
    tag: `pickup-${pickupId}`,
    variant: isParts || (!isStaged && (isTech || isPark)) ? "tech" : "default",
  };
}

async function sendWithRetry(sub: { endpoint: string; p256dh: string; auth: string }, payload: object) {
  try {
    await sendWebPush(sub, payload);
    return;
  } catch (error: unknown) {
    const status = (error as { statusCode?: number })?.statusCode;
    if (status === 404 || status === 410 || (status !== undefined && status < 500 && status !== 429)) throw error;
  }
  await new Promise((resolve) => setTimeout(resolve, 150));
  await sendWebPush(sub, payload);
}

export async function createPickupAndNotify(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: PickupSubmission,
): Promise<PickupDeliveryResult> {
  const { data: caller, error: callerError } = await supabase
    .from("profiles")
    .select("dealership_id, role_name, is_active, status")
    .eq("id", userId)
    .maybeSingle();
  if (callerError) throw callerError;
  if (!caller?.dealership_id || !caller.is_active || caller.status !== "approved") {
    throw new Error("Your account cannot submit pickup requests");
  }
  if (data.kind === "parts" && !PARTS_ROLES.includes(caller.role_name)) {
    throw new Error("You do not have access to Parts requests");
  }

  const sourceRole = data.sourceRole ?? caller.role_name;
  const { data: pickup, error: insertError } = await supabase
    .from("pickup_requests")
    .insert({
      kind: data.kind ?? "pickup",
      tag_number: data.tag ?? null,
      ro_number: data.ro ?? null,
      advisor_name: data.advisor ?? null,
      car_model: data.model ?? null,
      car_notes: data.notes ?? null,
      requested_by: userId,
      source_role: sourceRole,
      lot_position: data.lotPosition ?? null,
      is_staged: !!data.staged,
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  const empty = { pickupId: pickup.id, recipients: 0, devices: 0, sent: 0, pruned: 0, failed: 0 };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: recipients, error: recipientsError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("dealership_id", caller.dealership_id)
    .eq("is_active", true)
    .eq("status", "approved")
    .eq("notifications_enabled", true)
    .in("role_name", RECIPIENT_ROLES);
  if (recipientsError) {
    console.error("pickup notification recipient lookup failed", pickup.id, recipientsError.message);
    return { ...empty, failed: 1 };
  }
  if (!recipients?.length) return empty;

  const { data: subs, error: subscriptionsError } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", recipients.map((recipient) => recipient.id));
  if (subscriptionsError) {
    console.error("pickup notification subscription lookup failed", pickup.id, subscriptionsError.message);
    return { ...empty, recipients: recipients.length, failed: 1 };
  }
  if (!subs?.length) return { ...empty, recipients: recipients.length };

  const stale: string[] = [];
  let sent = 0;
  let failed = 0;
  const payload = payloadFor({ ...data, sourceRole }, pickup.id);
  await Promise.all(subs.map(async (sub) => {
    try {
      await sendWithRetry({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload);
      sent++;
    } catch (error: unknown) {
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) stale.push(sub.id);
      else {
        failed++;
        console.error("pickup notification delivery failed", pickup.id, status, (error as Error)?.message);
      }
    }
  }));
  if (stale.length) {
    const { error } = await supabaseAdmin.from("push_subscriptions").delete().in("id", stale);
    if (error) console.error("pickup notification stale-device cleanup failed", pickup.id, error.message);
  }

  console.info("pickup notification result", {
    pickupId: pickup.id,
    recipients: recipients.length,
    devices: subs.length,
    sent,
    pruned: stale.length,
    failed,
  });
  return { pickupId: pickup.id, recipients: recipients.length, devices: subs.length, sent, pruned: stale.length, failed };
}
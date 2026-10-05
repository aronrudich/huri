import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const inquirySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  businessName: z.string().trim().min(1).max(160),
  businessType: z.enum(["dealership", "auction"]),
  message: z.string().trim().max(3000).optional().default(""),
  submissionKey: z.string().uuid(),
  address: z.object({
    street: z.string().trim().min(1).max(200),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(100),
    zip: z.string().trim().min(1).max(20),
    formatted: z.string().trim().max(500).optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
  }),
});

/** Public: a visitor submits a business inquiry. Creates no account or company. */
export const submitBusinessInquiry = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => inquirySchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Double-tap / retry: same submission key returns success without duplicating.
    const { data: dup } = await supabaseAdmin
      .from("business_inquiries").select("id").eq("submission_key", data.submissionKey).maybeSingle();
    if (dup) return { ok: true };

    // Abuse limit: max 3 inquiries per email per hour, 30 total per hour.
    const since = new Date(Date.now() - 3600_000).toISOString();
    const [{ count: perEmail }, { count: total }] = await Promise.all([
      supabaseAdmin.from("business_inquiries").select("id", { count: "exact", head: true }).eq("email", data.email).gte("created_at", since),
      supabaseAdmin.from("business_inquiries").select("id", { count: "exact", head: true }).gte("created_at", since),
    ]);
    if ((perEmail ?? 0) >= 3 || (total ?? 0) >= 30) {
      throw new Error("Too many submissions. Please try again later.");
    }

    const a = data.address;
    const fullAddress = a.formatted || `${a.street}, ${a.city}, ${a.state} ${a.zip}`;
    const { data: row, error } = await supabaseAdmin.from("business_inquiries").insert({
      email: data.email,
      business_name: data.businessName,
      business_type: data.businessType,
      message: data.message || null,
      submission_key: data.submissionKey,
      street_address: data.address.street,
      city: data.address.city,
      state: data.address.state,
      zip: data.address.zip,
      formatted_address: fullAddress,
      latitude: data.address.lat ?? null,
      longitude: data.address.lng ?? null,
    }).select("id, created_at").single();
    if (error) {
      if (error.code === "23505") return { ok: true };
      console.error("[business] insert failed", error.code);
      throw new Error("Could not send right now. Please try again.");
    }

    // Seed the review draft so the map opens centered on the business.
    const hasPt = a.lat != null && a.lng != null;
    await supabaseAdmin.from("business_onboarding_drafts").insert({
      inquiry_id: row.id,
      current_step: 3,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      data: {
        businessName: data.businessName, businessType: data.businessType, contactEmail: data.email,
        address: { street: a.street, city: a.city, state: a.state, zip: a.zip },
        ...(hasPt ? { center: { lat: a.lat, lng: a.lng, zoom: 18 } } : {}),
        lots: [], rows: [], spots: [],
      } as never,
    });
    try {
      const { pushSupport } = await import("./onboarding.functions");
      await pushSupport({ title: "New business · Huri", body: `${data.businessName} (${data.businessType === "auction" ? "Auction" : "Dealership"}) · ${fullAddress}`, url: `/business-onboarding-review/${row.id}`, tag: `inquiry-${row.id}`, variant: "default" });
    } catch { /* push is best-effort */ }

    try {
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      await sendTemplateEmail("business-inquiry", "aron@huri.team", {
        idempotencyKey: `business-inquiry-${row.id}`,
        templateData: {
          businessName: data.businessName,
          businessType: data.businessType === "auction" ? "Auction" : "Dealership",
          email: data.email,
          message: data.message,
          address: fullAddress,
          submittedAt: new Date(row.created_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
        },
      });
      await supabaseAdmin.from("business_inquiries").update({ email_notification_sent_at: new Date().toISOString() }).eq("id", row.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 300) : "Email failed";
      await supabaseAdmin.from("business_inquiries").update({ email_notification_error: msg }).eq("id", row.id);
    }
    return { ok: true };
  });

const STATUSES = ["new", "contacted", "onboarding_sent", "onboarding_started", "submitted_for_review", "approved", "declined"] as const;

/** Support-only: change an inquiry's status. RLS also enforces Huri support. */
export const setInquiryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(STATUSES) }).parse(d))
  .handler(async ({ data, context }) => {
    const email = String((context.claims as { email?: string }).email ?? "").toLowerCase();
    if (!["aron@huri.team", "aron@oremor.net"].includes(email)) throw new Error("Not allowed");
    const { error } = await context.supabase.from("business_inquiries")
      .update({ status: data.status, reviewed_by: context.userId, reviewed_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error("Could not update");
    return { ok: true };
  });

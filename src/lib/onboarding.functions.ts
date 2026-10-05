import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SUPPORT = ["aron@huri.team", "aron@oremor.net"];
const LINK_DAYS = 30;
const BASE_URL = "https://huri.team";

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomToken() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function assertSupport(claims: unknown) {
  const email = String((claims as { email?: string }).email ?? "").toLowerCase();
  if (!SUPPORT.includes(email)) throw new Error("Not allowed");
}

/** Support: list link state per inquiry (never returns tokens). */
export const listOnboardingLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertSupport(context.claims);
    const [{ data: links }, { data: drafts }] = await Promise.all([
      context.supabase.from("business_onboarding_links")
        .select("id, inquiry_id, expires_at, revoked_at, first_opened_at, last_opened_at, emailed_at, created_at")
        .order("created_at", { ascending: false }),
      context.supabase.from("business_onboarding_drafts").select("inquiry_id, status, current_step, updated_at, submitted_at"),
    ]);
    return { links: links ?? [], drafts: drafts ?? [] };
  });

/** Support: create (or replace) the link. Old active links are revoked. Raw URL is returned once. */
export const createOnboardingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ inquiryId: z.string().uuid(), sendEmail: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }) => {
    assertSupport(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inq } = await supabaseAdmin.from("business_inquiries")
      .select("id, email, business_name, status").eq("id", data.inquiryId).maybeSingle();
    if (!inq) throw new Error("Inquiry not found");
    if (inq.status === "approved" || inq.status === "declined") throw new Error("This inquiry is closed");

    const now = new Date().toISOString();
    await supabaseAdmin.from("business_onboarding_links").update({ revoked_at: now })
      .eq("inquiry_id", inq.id).is("revoked_at", null);

    const token = randomToken();
    const { data: link, error } = await supabaseAdmin.from("business_onboarding_links").insert({
      inquiry_id: inq.id,
      token_hash: await sha256(token),
      expires_at: new Date(Date.now() + LINK_DAYS * 86400_000).toISOString(),
      created_by: context.userId,
    }).select("id").single();
    if (error) throw new Error("Could not create link");

    const url = `${BASE_URL}/business-onboarding/${token}`;
    let emailed = false;
    let emailError: string | null = null;
    if (data.sendEmail) {
      try {
        const { sendTemplateEmail } = await import("./email-templates/send-email");
        const r = await sendTemplateEmail("business-onboarding", inq.email, {
          idempotencyKey: `business-onboarding-${link.id}`,
          templateData: { link: url, businessName: inq.business_name },
        });
        emailed = r.sent;
        if (!r.sent) emailError = "This email address is blocked from receiving mail.";
        if (r.sent) await supabaseAdmin.from("business_onboarding_links").update({ emailed_at: now }).eq("id", link.id);
      } catch {
        emailError = "Email could not be sent. Copy the link and send it yourself.";
      }
    }
    if (["new", "contacted"].includes(inq.status)) {
      await supabaseAdmin.from("business_inquiries").update({ status: "onboarding_sent" }).eq("id", inq.id);
    }
    return { url, emailed, emailError };
  });

/** Support: revoke the active link. */
export const revokeOnboardingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ inquiryId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    assertSupport(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("business_onboarding_links").update({ revoked_at: new Date().toISOString() })
      .eq("inquiry_id", data.inquiryId).is("revoked_at", null);
    return { ok: true };
  });

// ---------- Public, token-gated ----------

const tokenSchema = z.string().min(30).max(80).regex(/^[A-Za-z0-9_-]+$/);

async function resolveToken(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: link } = await supabaseAdmin.from("business_onboarding_links")
    .select("id, inquiry_id, expires_at, revoked_at, first_opened_at")
    .eq("token_hash", await sha256(token)).maybeSingle();
  if (!link || link.revoked_at || new Date(link.expires_at) < new Date()) return null;
  return { supabaseAdmin, link };
}

const draftSchema = z.object({
  businessName: z.string().trim().max(160).optional(),
  businessType: z.enum(["dealership", "auction"]).optional(),
  contactEmail: z.string().trim().max(254).optional(),
  contactName: z.string().trim().max(120).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(3000).optional(),
}).passthrough();

/** Public: open onboarding with the secret link. Returns only that business's data. */
export const openOnboarding = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const parsed = tokenSchema.safeParse(data.token);
    if (!parsed.success) return { valid: false as const };
    const r = await resolveToken(parsed.data);
    if (!r) return { valid: false as const };
    const { supabaseAdmin, link } = r;
    const now = new Date().toISOString();
    await supabaseAdmin.from("business_onboarding_links")
      .update({ last_opened_at: now, ...(link.first_opened_at ? {} : { first_opened_at: now }) }).eq("id", link.id);

    const { data: inq } = await supabaseAdmin.from("business_inquiries")
      .select("email, business_name, business_type, status").eq("id", link.inquiry_id).single();
    if (!inq || inq.status === "approved" || inq.status === "declined") return { valid: false as const };
    if (inq.status === "onboarding_sent") {
      await supabaseAdmin.from("business_inquiries").update({ status: "onboarding_started" }).eq("id", link.inquiry_id);
    }
    const { data: draft } = await supabaseAdmin.from("business_onboarding_drafts")
      .select("data, current_step, status").eq("inquiry_id", link.inquiry_id).maybeSingle();
    return {
      valid: true as const,
      expiresAt: link.expires_at,
      inquiry: { email: inq.email, businessName: inq.business_name, businessType: inq.business_type },
      draft: draft ?? null,
    };
  });

/** Public: save progress with the secret link. Saving a submitted map returns it to draft. */
export const saveOnboardingDraft = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: tokenSchema,
    step: z.number().int().min(1).max(20),
    data: draftSchema,
  }).parse(d))
  .handler(async ({ data }) => {
    if (JSON.stringify(data.data).length > 200_000) throw new Error("Too much data");
    const r = await resolveToken(data.token);
    if (!r) throw new Error("This link is no longer valid");
    const { supabaseAdmin, link } = r;
    const { error } = await supabaseAdmin.from("business_onboarding_drafts").upsert({
      inquiry_id: link.inquiry_id,
      data: data.data as never,
      current_step: data.step,
      status: "draft",
      submitted_at: null,
    });
    if (error) throw new Error("Could not save. Please try again.");
    await supabaseAdmin.from("business_inquiries").update({ status: "onboarding_started" })
      .eq("id", link.inquiry_id).eq("status", "submitted_for_review");
    return { ok: true, savedAt: new Date().toISOString() };
  });

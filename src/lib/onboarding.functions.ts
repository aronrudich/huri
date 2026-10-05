import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { draftSchema, draftStats, MAX_DRAFT_BYTES } from "./onboarding-schema";

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
      .select("data, current_step, status, review_message, submitted_at").eq("inquiry_id", link.inquiry_id).maybeSingle();
    return {
      valid: true as const,
      expiresAt: link.expires_at,
      inquiry: { email: inq.email, businessName: inq.business_name, businessType: inq.business_type },
      draft: draft ?? null,
    };
  });

/** Public: save progress with the secret link. Locked once submitted for review. */
export const saveOnboardingDraft = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: tokenSchema,
    step: z.number().int().min(1).max(20),
    data: draftSchema,
  }).parse(d))
  .handler(async ({ data }) => {
    if (JSON.stringify(data.data).length > MAX_DRAFT_BYTES) throw new Error("This map is too large to save. Remove some spots and try again.");
    const r = await resolveToken(data.token);
    if (!r) throw new Error("This link is no longer valid");
    const { supabaseAdmin, link } = r;
    const { data: cur } = await supabaseAdmin.from("business_onboarding_drafts").select("status").eq("inquiry_id", link.inquiry_id).maybeSingle();
    if (cur && ["submitted", "approved", "activated"].includes(cur.status)) throw new Error("Your map was already submitted for review.");
    const { error } = await supabaseAdmin.from("business_onboarding_drafts").upsert({
      inquiry_id: link.inquiry_id,
      data: data.data as never,
      current_step: data.step,
      status: cur?.status === "changes_requested" ? "changes_requested" : "draft",
    });
    if (error) throw new Error("Could not save. Please try again.");
    return { ok: true, savedAt: new Date().toISOString() };
  });

/** Public: submit the map for Huri review. Creates nothing — only marks the draft submitted and alerts support. */
export const submitOnboarding = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenSchema, data: draftSchema }).parse(d))
  .handler(async ({ data }) => {
    if (JSON.stringify(data.data).length > MAX_DRAFT_BYTES) throw new Error("This map is too large to submit.");
    const r = await resolveToken(data.token);
    if (!r) throw new Error("This link is no longer valid");
    const { supabaseAdmin, link } = r;
    const stats = draftStats(data.data);
    if (!data.data.businessName?.trim()) throw new Error("Business name is required");
    void stats;
    const ad = data.data.address ?? {};
    if (!(ad.street?.trim() && (ad.city?.trim() || ad.zip?.trim()))) throw new Error("Please enter your business address");
    const { data: cur } = await supabaseAdmin.from("business_onboarding_drafts").select("status").eq("inquiry_id", link.inquiry_id).maybeSingle();
    if (cur && ["submitted", "approved", "activated"].includes(cur.status)) return { ok: true, already: true };
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("business_onboarding_drafts").upsert({
      inquiry_id: link.inquiry_id, data: data.data as never, current_step: 7, status: "submitted", submitted_at: now, review_message: null,
    });
    if (error) throw new Error("Could not submit. Please try again.");
    await supabaseAdmin.from("business_inquiries").update({ status: "submitted_for_review" }).eq("id", link.inquiry_id);
    await supabaseAdmin.from("business_onboarding_activity").insert({
      inquiry_id: link.inquiry_id, actor_label: "Business", section: "submitted", summary: stats as never,
    });
    const name = data.data.businessName ?? "";
    const type = data.data.businessType === "auction" ? "Auction" : "Dealership";
    try {
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      await sendTemplateEmail("onboarding-submitted", SUPPORT[0], {
        idempotencyKey: `onboarding-submitted-${link.inquiry_id}-${now}`,
        templateData: { businessName: name, businessType: type, inquiryId: link.inquiry_id, lots: stats.lots, spots: stats.spots },
      });
    } catch (e) { console.error("onboarding submit email failed", (e as Error).message); }
    try {
      await pushSupport({ title: "Map submitted · Huri Business", body: `${name} (${type}) sent their property map for review.`, url: `/business-onboarding-review/${link.inquiry_id}`, tag: `onboarding-${link.inquiry_id}`, variant: "default" });
    } catch (e) { console.error("onboarding submit push failed", (e as Error).message); }
    return { ok: true, already: false };
  });

async function pushSupport(payload: object) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendWebPush, isStalePushStatus } = await import("./push-server.server");
  const { data: people } = await supabaseAdmin.from("profiles").select("id").in("email", SUPPORT);
  const ids = (people ?? []).map((p) => p.id);
  if (!ids.length) return;
  const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", ids);
  const stale: string[] = [];
  await Promise.all((subs ?? []).map(async (s) => {
    try { await sendWebPush(s, payload); }
    catch (e) { if (isStalePushStatus((e as { statusCode?: number })?.statusCode)) stale.push(s.id); }
  }));
  if (stale.length) await supabaseAdmin.from("push_subscriptions").delete().in("id", stale);
}

// ---------- Huri Support review ----------

const idInput = z.object({ inquiryId: z.string().uuid() });

async function supportCtx(claims: unknown) {
  assertSupport(claims);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function logActivity(admin: Awaited<ReturnType<typeof supportCtx>>, inquiryId: string, actor: string, section: string, summary: object = {}) {
  await admin.from("business_onboarding_activity").insert({ inquiry_id: inquiryId, actor_id: actor, actor_label: "Huri Support", section, summary: summary as never });
}

/** Support: full review payload for one inquiry. */
export const getOnboardingReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    assertSupport(context.claims);
    const sb = context.supabase;
    const [{ data: inquiry }, { data: draft }, { data: activity }, { data: links }] = await Promise.all([
      sb.from("business_inquiries").select("id, email, business_name, business_type, message, status, created_at, company_id, activated_at, activation_emailed_at").eq("id", data.inquiryId).maybeSingle(),
      sb.from("business_onboarding_drafts").select("data, status, current_step, submitted_at, updated_at, review_message, reviewer_notes, approved_at").eq("inquiry_id", data.inquiryId).maybeSingle(),
      sb.from("business_onboarding_activity").select("id, actor_label, section, summary, created_at").eq("inquiry_id", data.inquiryId).order("created_at", { ascending: false }).limit(50),
      sb.from("business_onboarding_links").select("expires_at, revoked_at, last_opened_at, created_at").eq("inquiry_id", data.inquiryId).order("created_at", { ascending: false }).limit(1),
    ]);
    if (!inquiry) throw new Error("Not found");
    let company: { name: string; code: string; businessType: string } | null = null;
    if (inquiry.company_id) {
      const admin = await supportCtx(context.claims);
      const { data: d } = await admin.from("dealerships").select("name, company_code, business_type").eq("id", inquiry.company_id).single();
      if (d) company = { name: d.name, code: d.company_code, businessType: d.business_type };
    }
    return { inquiry, draft, activity: activity ?? [], link: links?.[0] ?? null, company };
  });

/** Support: save map edits. Logged in Activity with before/after counts. */
export const saveReviewDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.extend({ data: draftSchema, section: z.string().max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await supportCtx(context.claims);
    if (JSON.stringify(data.data).length > MAX_DRAFT_BYTES) throw new Error("Map too large");
    const { data: cur } = await admin.from("business_onboarding_drafts").select("data, status").eq("inquiry_id", data.inquiryId).maybeSingle();
    if (cur?.status === "activated") throw new Error("This company is already activated");
    const { error } = await admin.from("business_onboarding_drafts").upsert({
      inquiry_id: data.inquiryId, data: data.data as never, status: cur?.status ?? "draft",
    });
    if (error) throw new Error("Could not save");
    await logActivity(admin, data.inquiryId, context.userId, data.section, {
      before: draftStats((cur?.data ?? {}) as never), after: draftStats(data.data),
    });
    return { ok: true, savedAt: new Date().toISOString() };
  });

export const saveReviewerNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.extend({ notes: z.string().max(5000) }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await supportCtx(context.claims);
    const { data: cur } = await admin.from("business_onboarding_drafts").select("inquiry_id").eq("inquiry_id", data.inquiryId).maybeSingle();
    if (!cur) throw new Error("No onboarding yet");
    await admin.from("business_onboarding_drafts").update({ reviewer_notes: data.notes }).eq("inquiry_id", data.inquiryId);
    return { ok: true };
  });

/** Support: send back for changes. Issues a fresh secure link (raw tokens are never stored) and emails it. */
export const requestOnboardingChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.extend({ message: z.string().trim().min(1).max(3000) }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await supportCtx(context.claims);
    const { data: inq } = await admin.from("business_inquiries").select("id, email, business_name, company_id").eq("id", data.inquiryId).maybeSingle();
    if (!inq) throw new Error("Not found");
    if (inq.company_id) throw new Error("This company is already activated");
    const { data: cur } = await admin.from("business_onboarding_drafts").select("status").eq("inquiry_id", inq.id).maybeSingle();
    if (!cur) throw new Error("Nothing has been submitted yet");
    await admin.from("business_onboarding_drafts").update({ status: "changes_requested", review_message: data.message, approved_at: null, approved_by: null }).eq("inquiry_id", inq.id);
    await admin.from("business_inquiries").update({ status: "changes_requested" }).eq("id", inq.id);

    const now = new Date().toISOString();
    await admin.from("business_onboarding_links").update({ revoked_at: now }).eq("inquiry_id", inq.id).is("revoked_at", null);
    const token = randomToken();
    const { data: link } = await admin.from("business_onboarding_links").insert({
      inquiry_id: inq.id, token_hash: await sha256(token),
      expires_at: new Date(Date.now() + LINK_DAYS * 86400_000).toISOString(), created_by: context.userId,
    }).select("id").single();
    const url = `${BASE_URL}/business-onboarding/${token}`;
    let emailed = false;
    try {
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      const r = await sendTemplateEmail("onboarding-changes", inq.email, {
        idempotencyKey: `onboarding-changes-${link?.id}`, templateData: { link: url, businessName: inq.business_name, message: data.message },
      });
      emailed = r.sent;
      if (r.sent && link) await admin.from("business_onboarding_links").update({ emailed_at: now }).eq("id", link.id);
    } catch (e) { console.error("changes email failed", (e as Error).message); }
    await logActivity(admin, inq.id, context.userId, "changes_requested", { message: data.message.slice(0, 300), emailed });
    return { ok: true, url, emailed };
  });

/** Support: mark the map approved so the company can be created. */
export const approveOnboardingMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    const admin = await supportCtx(context.claims);
    const { data: cur } = await admin.from("business_onboarding_drafts").select("status, data").eq("inquiry_id", data.inquiryId).maybeSingle();
    if (!cur || !["submitted", "changes_requested", "approved"].includes(cur.status)) throw new Error("The map must be submitted first");
    if (!draftStats(cur.data as never).boundary) throw new Error("A property boundary is required");
    await admin.from("business_onboarding_drafts").update({ status: "approved", approved_by: context.userId, approved_at: new Date().toISOString() }).eq("inquiry_id", data.inquiryId);
    await logActivity(admin, data.inquiryId, context.userId, "map_approved");
    return { ok: true };
  });

/** Support: atomic company creation + permanent code. Safe to retry — never creates twice. */
export const activateOnboardingCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    const admin = await supportCtx(context.claims);
    const { data: res, error } = await admin.rpc("activate_business_onboarding" as never, { _inquiry_id: data.inquiryId, _actor: context.userId } as never);
    if (error) throw new Error(error.message.includes("approved") ? "Mark the map approved first" : "Could not create the company");
    return res as unknown as { already: boolean; id: string; name: string; code: string; businessType: string; activatedAt: string };
  });

/** Support: deliberately email the company code to the contact. Every send is logged. */
export const sendActivationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.extend({ email: z.string().trim().toLowerCase().email().max(254) }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await supportCtx(context.claims);
    const { data: inq } = await admin.from("business_inquiries").select("id, company_id").eq("id", data.inquiryId).maybeSingle();
    if (!inq?.company_id) throw new Error("Create the company first");
    const { data: d } = await admin.from("dealerships").select("name, company_code").eq("id", inq.company_id).single();
    if (!d) throw new Error("Company not found");
    const { sendTemplateEmail } = await import("./email-templates/send-email");
    const r = await sendTemplateEmail("company-activated", data.email, {
      idempotencyKey: `company-activated-${inq.id}-${Date.now()}`, templateData: { businessName: d.name, code: d.company_code },
    });
    if (!r.sent) throw new Error("This email address is blocked from receiving mail.");
    await admin.from("business_inquiries").update({ activation_emailed_at: new Date().toISOString() }).eq("id", inq.id);
    await logActivity(admin, inq.id, context.userId, "activation_email", { to: data.email });
    return { ok: true };
  });

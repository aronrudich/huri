import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Customer-facing arrival flow. These functions are deliberately public: the
 * customer taps a link from their service advisor's text message and never
 * signs in. Only the company's public handle travels in the link — never the
 * private employee company code.
 */

const slugSchema = z.string().trim().toLowerCase().min(2).max(40).regex(/^[a-z0-9-]+$/);
const roSchema = z.string().trim().max(32).regex(/^[A-Za-z0-9-]*$/).optional();

export type ArrivalInfo = {
  companyName: string;
  ro: string | null;
  /** ISO time already chosen on a previous visit, so reopening the link keeps it. */
  currentEta: string | null;
  timezone: string;
};

export const getArrivalInfo = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string; ro?: string }) =>
    z.object({ slug: slugSchema, ro: roSchema }).parse(data))
  .handler(async ({ data }): Promise<ArrivalInfo | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: company } = await supabaseAdmin
      .from("dealerships")
      .select("id, name, timezone")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!company) return null;

    let currentEta: string | null = null;
    if (data.ro) {
      const { data: open } = await supabaseAdmin
        .from("pickup_requests")
        .select("customer_eta")
        .eq("dealership_id", company.id)
        .eq("ro_number", data.ro)
        .not("customer_eta", "is", null)
        .in("status", ["unclaimed", "claimed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      currentEta = open?.customer_eta ?? null;
    }

    return {
      companyName: company.name,
      ro: data.ro ?? null,
      currentEta,
      timezone: company.timezone,
    };
  });

export const submitArrival = createServerFn({ method: "POST" })
  .inputValidator((data: { slug: string; ro?: string; hour: number; minute: number; meridiem: "AM" | "PM" }) =>
    z.object({
      slug: slugSchema,
      ro: roSchema,
      hour: z.number().int().min(1).max(12),
      minute: z.number().int().min(0).max(59),
      meridiem: z.enum(["AM", "PM"]),
    }).parse(data))
  .handler(async ({ data }): Promise<{ eta: string }> => {
    // PREVIEW ONLY. This flow is switched off on purpose: it must not reach the
    // staff pickup list and must not send any notification until it goes live.
    // It only confirms the chosen time back to the customer's screen.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveEta } = await import("./arrive.server");

    const { data: company } = await supabaseAdmin
      .from("dealerships")
      .select("timezone")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!company) throw new Error("We could not find that dealership.");

    const eta = resolveEta(company.timezone, data.hour, data.minute, data.meridiem);
    return { eta: eta.toISOString() };
  });

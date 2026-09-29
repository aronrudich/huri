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

/** Arrivals open for claiming this long before the customer's time. */
export const ARRIVAL_LEAD_MS = 20 * 60_000;

export type ArrivalInfo = {
  companyName: string;
  ro: string | null;
  /** ISO time already chosen on a previous visit, so reopening the link keeps it. */
  currentEta: string | null;
  timezone: string;
  /** Today on the company's clock, YYYY-MM-DD. */
  today: string;
};

export const getArrivalInfo = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string; ro?: string }) =>
    z.object({ slug: slugSchema, ro: roSchema }).parse(data))
  .handler(async ({ data }): Promise<ArrivalInfo | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { companyToday } = await import("./arrive.server");
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
      today: companyToday(company.timezone),
    };
  });

export const submitArrival = createServerFn({ method: "POST" })
  .inputValidator((data: { slug: string; ro?: string; date: string; hour: number; minute: number; meridiem: "AM" | "PM" }) =>
    z.object({
      slug: slugSchema,
      ro: roSchema,
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      hour: z.number().int().min(1).max(12),
      minute: z.number().int().min(0).max(59),
      meridiem: z.enum(["AM", "PM"]),
    }).parse(data))
  .handler(async ({ data }): Promise<{ eta: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveEta, companyToday, notifyValetsOfArrival } = await import("./arrive.server");

    const { data: company } = await supabaseAdmin
      .from("dealerships")
      .select("id, timezone")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!company) throw new Error("We could not find that dealership.");
    if (data.date < companyToday(company.timezone)) throw new Error("Please pick today or a later day.");

    const eta = resolveEta(company.timezone, data.date, data.hour, data.minute, data.meridiem);
    if (eta.getTime() < Date.now() - 5 * 60_000) throw new Error("That time has already passed.");
    const ro = data.ro?.trim() || null;
    const etaIso = eta.toISOString();
    const activeNow = eta.getTime() - ARRIVAL_LEAD_MS <= Date.now();

    // One card per RO: reopening the link updates the same card.
    let existing: { id: string; status: string; eta_notified_at: string | null } | null = null;
    if (ro) {
      const { data: open } = await supabaseAdmin
        .from("pickup_requests")
        .select("id, status, eta_notified_at")
        .eq("dealership_id", company.id)
        .eq("ro_number", ro)
        .in("status", ["unclaimed", "claimed"])
        .not("customer_eta", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      existing = open;
    }

    let pickupId: string;
    if (existing) {
      const { error } = await supabaseAdmin
        .from("pickup_requests")
        .update({ customer_eta: etaIso, eta_notified_at: activeNow ? existing.eta_notified_at : null, reminded_at: null })
        .eq("id", existing.id);
      if (error) throw new Error("We couldn't save your arrival time.");
      pickupId = existing.id;
      if (!activeNow || existing.eta_notified_at || existing.status !== "unclaimed") return { eta: etaIso };
    } else {
      let lotPosition: string | null = null;
      let carModel: string | null = null;
      if (ro) {
        const { data: car } = await supabaseAdmin
          .from("parked_cars")
          .select("lot_position, car_model")
          .eq("dealership_id", company.id)
          .eq("ro_number", ro)
          .maybeSingle();
        lotPosition = car?.lot_position ?? null;
        carModel = car?.car_model ?? null;
      }
      const { data: row, error } = await supabaseAdmin
        .from("pickup_requests")
        .insert({
          dealership_id: company.id,
          kind: "pickup",
          source_role: "Customer",
          status: "unclaimed",
          ro_number: ro,
          customer_eta: etaIso,
          lot_position: lotPosition,
          car_model: carModel,
          advisor_name: "Customer",
        } as never)
        .select("id")
        .single();
      if (error || !row) {
        console.error("arrival insert failed", error);
        throw new Error("We couldn't save your arrival time.");
      }
      pickupId = (row as { id: string }).id;
      if (!activeNow) return { eta: etaIso };
    }

    await notifyValetsOfArrival(supabaseAdmin, company.id, {
      title: "🚗 Customer arriving soon",
      body: `${ro ? `RO #${ro} · ` : ""}Arriving ${new Intl.DateTimeFormat("en-US", { timeZone: company.timezone, hour: "numeric", minute: "2-digit" }).format(eta)}`,
      url: "/pickup",
      tag: `arrival-${pickupId}`,
      variant: "customer",
    });
    await supabaseAdmin.from("pickup_requests").update({ eta_notified_at: new Date().toISOString() }).eq("id", pickupId);
    return { eta: etaIso };
  });

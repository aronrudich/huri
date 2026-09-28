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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveEta, notifyValetsOfArrival } = await import("./arrive.server");

    const { data: company } = await supabaseAdmin
      .from("dealerships")
      .select("id, name, timezone")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!company) throw new Error("We could not find that dealership.");

    const eta = resolveEta(company.timezone, data.hour, data.minute, data.meridiem);
    const etaIso = eta.toISOString();
    const clock = `${data.hour}:${String(data.minute).padStart(2, "0")} ${data.meridiem}`;

    // Where the car is standing right now, plus its model, so the valets see
    // the spot and blockers the moment the card lands on their list.
    let lotPosition: string | null = null;
    let carModel: string | null = null;
    let carExists = false;
    if (data.ro) {
      const { data: car } = await supabaseAdmin
        .from("parked_cars")
        .select("lot_position, car_model")
        .eq("dealership_id", company.id)
        .eq("ro_number", data.ro)
        .order("located_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      carExists = !!car;
      lotPosition = car?.lot_position ?? null;
      carModel = car?.car_model ?? null;
    }

    // Reopening the link updates the same card instead of creating a duplicate.
    if (data.ro) {
      const { data: open } = await supabaseAdmin
        .from("pickup_requests")
        .select("id")
        .eq("dealership_id", company.id)
        .eq("ro_number", data.ro)
        .not("customer_eta", "is", null)
        .in("status", ["unclaimed", "claimed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (open?.id) {
        const { error } = await supabaseAdmin
          .from("pickup_requests")
          .update({ customer_eta: etaIso } as never)
          .eq("id", open.id);
        if (error) throw error;
        await notifyValetsOfArrival(supabaseAdmin, company.id, {
          title: "🕒 Customer updated their arrival time",
          body: [data.ro && `RO #${data.ro}`, `Now arriving ${clock}`].filter(Boolean).join(" · "),
          url: "/pickup",
          tag: `arrival-${open.id}`,
          variant: "default",
        });
        return { eta: etaIso };
      }
    }

    // An RO Huri has never seen is added with an unknown location, so the car
    // exists in the system from this moment and can be found and edited.
    if (data.ro && !carExists) {
      const { error } = await supabaseAdmin
        .from("parked_cars")
        .insert({
          dealership_id: company.id,
          ro_number: data.ro,
          lot_position: "UNKNOWN",
        } as never);
      if (error) console.error("could not add car for customer arrival", data.ro, error.message);
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from("pickup_requests")
      .insert({
        dealership_id: company.id,
        kind: "pickup",
        ro_number: data.ro ?? null,
        car_model: carModel,
        lot_position: lotPosition,
        source_role: "Customer",
        customer_eta: etaIso,
        status: "unclaimed",
      } as never)
      .select("id")
      .single();
    if (insertError) throw insertError;

    await notifyValetsOfArrival(supabaseAdmin, company.id, {
      title: "🔵 Customer on the way — bring car up",
      body: [data.ro && `RO #${data.ro}`, `Arriving ${clock}`, carModel].filter(Boolean).join(" · "),
      url: "/pickup",
      tag: `arrival-${created.id}`,
      variant: "default",
    });

    return { eta: etaIso };
  });

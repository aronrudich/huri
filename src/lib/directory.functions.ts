import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function callerDealership(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles").select("dealership_id").eq("id", userId).maybeSingle();
  return data?.dealership_id ?? null;
}

export const getMessageRecipients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dealershipId = await callerDealership(context.userId);
    if (!dealershipId) return [];

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, nickname, role_name, phone_number")
      .eq("is_active", true)
      .eq("status", "approved")
      .eq("dealership_id", dealershipId)
      .neq("id", context.userId)
      .order("full_name", { ascending: true });

    if (error) throw error;

    return (data ?? []).map((person) => ({
      id: person.id,
      fullName: person.full_name,
      nickname: person.nickname,
      roleName: person.role_name,
      phoneNumber: person.phone_number,
    }));
  });

export const getDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dealershipId = await callerDealership(context.userId);
    if (!dealershipId) return [];

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, nickname, role_name, role_id, is_active, phone_number")
      .eq("dealership_id", dealershipId);

    if (error) throw error;

    return data ?? [];
  });

export const searchCars = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { q: string }) => input)
  .handler(async ({ data, context }) => {
    const q = (data.q ?? "").trim();
    if (q.length < 1) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dealershipId = await callerDealership(context.userId);
    if (!dealershipId) return [];

    const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
    const { data: rows, error } = await supabaseAdmin
      .from("parked_cars")
      .select("id, ro_number, car_model, lot_position, notes")
      .eq("dealership_id", dealershipId)
      .or(
        `ro_number.ilike.${like},car_model.ilike.${like},lot_position.ilike.${like}`,
      )
      .limit(20);

    if (error) throw error;
    return rows ?? [];
  });

export const getPublicProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dealershipId = await callerDealership(context.userId);
    if (!dealershipId) return null;

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, nickname, role_name, phone_number, email, dealership_id")
      .eq("id", data.userId)
      .eq("dealership_id", dealershipId)
      .maybeSingle();

    if (error) throw error;
    if (!profile) return null;

    const { data: dealer } = await supabaseAdmin
      .from("dealerships")
      .select("name")
      .eq("id", profile.dealership_id!)
      .maybeSingle();

    return {
      id: profile.id,
      fullName: profile.full_name,
      nickname: profile.nickname,
      roleName: profile.role_name,
      phoneNumber: profile.phone_number,
      email: profile.email,
      dealershipName: dealer?.name ?? null,
    };
  });

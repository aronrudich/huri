import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAronEmail } from "./aron";

async function verifySupport(context: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string }) {
  const { data: auth, error } = await context.supabase.auth.getUser();
  if (error || auth.user?.id !== context.userId || !auth.user.email_confirmed_at || !isAronEmail(auth.user.email)) throw new Error("Huri Support only");
  const { data: profile, error: profileError } = await context.supabase.from("profiles").select("status,is_active,role_name").eq("id", context.userId).single();
  if (profileError || profile?.status !== "approved" || !profile.is_active || profile.role_name === "Spectator") throw new Error("Active Huri Support account required");
}

export const listSwitchableDealerships = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await verifySupport(context);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { loadAllCarPages } = await import("./car-loading");
  return loadAllCarPages((from, to) => supabaseAdmin.from("dealerships").select("id,name").order("name").order("id").range(from, to));
});

export const switchActiveDealership = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ dealershipId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await verifySupport(context);
    // Service-role write is authorized only after revalidating the authenticated Support identity.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: company, error: companyError } = await supabaseAdmin.from("dealerships").select("id").eq("id", data.dealershipId).single();
    if (companyError || !company) throw new Error("Company not found");
    const { error } = await supabaseAdmin.from("profiles").update({ dealership_id: company.id }).eq("id", context.userId);
    if (error) throw new Error("Could not switch dealership");
    return { dealershipId: company.id };
  });
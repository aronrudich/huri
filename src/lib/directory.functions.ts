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
      .select("id, full_name, nickname, role_name")
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
      .select("id, full_name, nickname, role_name, role_id, is_active")
      .eq("dealership_id", dealershipId);

    if (error) throw error;

    return data ?? [];
  });

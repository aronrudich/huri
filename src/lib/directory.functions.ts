import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMessageRecipients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, nickname, role_name")
      .eq("is_active", true)
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
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function callerDealership(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles").select("dealership_id").eq("id", userId).maybeSingle();
  return data?.dealership_id ?? null;
}

/**
 * Photos live on the profile row as base64. Lists send a cacheable image URL
 * instead of the image data, so a roster response stays a few KB.
 */
export const avatarUrlFor = (
  id: string,
  hasAvatar?: boolean | null,
  version?: string | null,
): string | null => (hasAvatar ? `/api/public/avatar/${id}?v=${version ?? ""}` : null);

export const getMessageRecipients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Single round trip: the function scopes to the caller's dealership itself.
    const { data, error } = await supabaseAdmin.rpc("message_recipients_for", {
      _uid: context.userId,
    });
    if (error) throw error;

    return (data ?? []).map((person) => ({
      id: person.id,
      fullName: person.full_name,
      nickname: person.nickname,
      roleName: person.role_name,
      avatarUrl: avatarUrlFor(person.id, person.has_avatar, person.avatar_version),
    }));
  });

export const getDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("directory_for", {
      _uid: context.userId,
    });
    if (error) throw error;

    return (data ?? []).map((person) => ({
      id: person.id,
      full_name: person.full_name,
      nickname: person.nickname,
      role_name: person.role_name,
      role_id: person.role_id,
      is_active: person.is_active,
      avatar_url: avatarUrlFor(person.id, person.has_avatar, person.avatar_version),
    }));
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

    // Commas and parentheses are structural in PostgREST's .or() grammar, so they
    // are stripped from user input before the filter string is assembled.
    const safe = q.replace(/[(),]/g, " ").replace(/[%_]/g, "\\$&");
    if (!safe.trim()) return [];
    const like = `%${safe}%`;

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
      .select("id, full_name, nickname, role_name, email, dealership_id, has_avatar, avatar_version")
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
      email: profile.email,
      avatarUrl: avatarUrlFor(profile.id, profile.has_avatar, profile.avatar_version),
      dealershipName: dealer?.name ?? null,
    };
  });

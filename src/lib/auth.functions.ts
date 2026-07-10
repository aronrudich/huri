import { createClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const emailPasswordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const confirmedSignupSchema = emailPasswordSchema.extend({
  fullName: z.string().trim().min(1).max(120),
  nickname: z.string().trim().max(120).optional(),
  roleName: z.string().trim().min(1).max(120),
  dealershipId: z.string().uuid(),
});


function createAuthClient(key: string) {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;

  if (!url) throw new Error("Account confirmation is missing the backend URL.");

  return createClient<Database>(url, key, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const confirmEmailForValidCredentials = createServerFn({ method: "POST" })
  .inputValidator((data) => emailPasswordSchema.parse(data))
  .handler(async ({ data }) => {
    const publishableKey =
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY;
    const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

    if (!publishableKey || !secretKey) {
      throw new Error("Account confirmation is not configured for this deployment.");
    }

    const publicClient = createAuthClient(publishableKey);
    const { error: signInError } = await publicClient.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (!signInError) return { confirmed: false, retryLogin: true };
    if (!/email not confirmed/i.test(signInError.message)) throw new Error(signInError.message);

    const adminClient = createAuthClient(secretKey);
    const targetEmail = data.email.trim().toLowerCase();
    const perPage = 1000;

    for (let page = 1; page <= 20; page++) {
      const { data: usersPage, error: listError } = await adminClient.auth.admin.listUsers({
        page,
        perPage,
      });
      if (listError) throw new Error("Could not look up this account for confirmation.");

      const user = usersPage.users.find(
        (candidate) => candidate.email?.toLowerCase() === targetEmail,
      );
      if (user) {
        const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
          email_confirm: true,
        });
        if (updateError) throw new Error("Could not confirm this account automatically.");
        return { confirmed: true, retryLogin: true };
      }

      if (usersPage.users.length < perPage) break;
    }

    throw new Error("Account not found for confirmation.");
  });

export const createConfirmedAccount = createServerFn({ method: "POST" })
  .inputValidator((data) => confirmedSignupSchema.parse(data))
  .handler(async ({ data }) => {
    const publishableKey =
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY;
    const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

    if (!publishableKey || !secretKey) {
      throw new Error("Account creation is not configured for this deployment.");
    }

    const adminClient = createAuthClient(secretKey);
    const targetEmail = data.email.trim().toLowerCase();
    const fullName = data.fullName.trim();
    const nickname = data.nickname?.trim() || null;
    const roleName = data.roleName.trim();

    const ensureProfile = async (userId: string) => {
      const { data: roleRow, error: roleError } = await adminClient
        .from("roles")
        .upsert({ name: roleName }, { onConflict: "name" })
        .select("id")
        .maybeSingle();
      if (roleError) throw new Error("Could not save this role.");

      const { error: profileError } = await adminClient.from("profiles").upsert(
        {
          id: userId,
          full_name: fullName,
          nickname,
          email: targetEmail,
          role_id: roleRow?.id ?? null,
          role_name: roleName,
          is_active: true,
          status: "pending",
          deactivated_at: null,
          deactivated_by: null,
        },
        { onConflict: "id" },
      );
      if (profileError) throw new Error("Could not add this account to Huri people.");
    };

    const created = await adminClient.auth.admin.createUser({
      email: targetEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (!created.error) {
      await ensureProfile(created.data.user.id);
      return { userId: created.data.user.id };
    }

    if (!/already|registered|exists/i.test(created.error.message)) {
      throw new Error(created.error.message);
    }

    const publicClient = createAuthClient(publishableKey);
    const { data: signInData, error: signInError } = await publicClient.auth.signInWithPassword({
      email: targetEmail,
      password: data.password,
    });

    if (!signInError) {
      if (signInData.user?.id) await ensureProfile(signInData.user.id);
      return { userId: signInData.user?.id ?? null };
    }
    if (!/email not confirmed/i.test(signInError.message)) {
      throw new Error("That email already has an account. Try signing in instead.");
    }

    const perPage = 1000;
    for (let page = 1; page <= 20; page++) {
      const { data: usersPage, error: listError } = await adminClient.auth.admin.listUsers({
        page,
        perPage,
      });
      if (listError) throw new Error("Could not look up this account for confirmation.");

      const user = usersPage.users.find(
        (candidate) => candidate.email?.toLowerCase() === targetEmail,
      );
      if (user) {
        const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });
        if (updateError) throw new Error("Could not confirm this account automatically.");
        await ensureProfile(user.id);
        return { userId: user.id };
      }

      if (usersPage.users.length < perPage) break;
    }

    throw new Error("Account not found for confirmation.");
  });

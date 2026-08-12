import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

const SESSION_TIMEOUT_MS = 1500;

export const attachResilientSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let token: string | undefined;

    try {
      const sessionResult = await Promise.race([
        supabase.auth.getSession(),
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), SESSION_TIMEOUT_MS)),
      ]);
      token = sessionResult?.data.session?.access_token;
    } catch {
      // Public server functions, including the desktop sign-in fallback, must
      // still run when a stale browser session cannot be refreshed.
    }

    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
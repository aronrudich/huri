import { getRequest } from "@tanstack/react-start/server";

/**
 * Account creation is the one door into Huri that no signed-in session guards,
 * so repeated attempts from the same email or the same device are slowed down.
 * Attempts are recorded in a table only the server can read or write.
 */

const WINDOW_MINUTES = 15;
const MAX_PER_EMAIL = 5;
const MAX_PER_CLIENT = 12;

async function hash(value: string) {
  const bytes = new TextEncoder().encode(`huri-signup:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function clientKey() {
  try {
    const headers = getRequest()?.headers;
    const ip =
      headers?.get("cf-connecting-ip") ||
      headers?.get("x-real-ip") ||
      headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
    return ip || "unknown-client";
  } catch {
    return "unknown-client";
  }
}

export async function enforceSignupThrottle(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

  const checks: Array<{ key: string; max: number }> = [
    { key: `email:${await hash(email.trim().toLowerCase())}`, max: MAX_PER_EMAIL },
    { key: `client:${await hash(clientKey())}`, max: MAX_PER_CLIENT },
  ];

  for (const check of checks) {
    const { count, error } = await supabaseAdmin
      .from("signup_attempts")
      .select("id", { count: "exact", head: true })
      .eq("attempt_key", check.key)
      .gte("created_at", since);
    // A failed count check must never block a legitimate sign-up.
    if (error) continue;
    if ((count ?? 0) >= check.max) {
      throw new Error("Too many sign-up attempts. Wait a few minutes and try again.");
    }
  }

  await supabaseAdmin
    .from("signup_attempts")
    .insert(checks.map((c) => ({ attempt_key: c.key })));

  // Opportunistic cleanup so the table stays tiny.
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  await supabaseAdmin.from("signup_attempts").delete().lt("created_at", cutoff);
}

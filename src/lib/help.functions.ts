import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SUPPORT_EMAIL = "aron@huri.team";
const SUPPORT_ACCOUNTS = ["aron@huri.team", "aron@oremor.net"];
const isSupportEmail = (e: string) => SUPPORT_ACCOUNTS.includes(e.toLowerCase());

async function pushToUser(userId: string, payload: object) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendWebPush, isStalePushStatus } = await import("./push-server.server");
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  const stale: string[] = [];
  await Promise.all((subs ?? []).map(async (s) => {
    try { await sendWebPush(s, payload); }
    catch (e: unknown) {
      if (isStalePushStatus((e as { statusCode?: number })?.statusCode)) stale.push(s.id);
    }
  }));
  if (stale.length) await supabaseAdmin.from("push_subscriptions").delete().in("id", stale);
}

const snippet = (t: string) => (t.length > 120 ? `${t.slice(0, 117)}…` : t);

/** Is the signed-in user Huri support? */
export const getHelpIdentity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = String((context.claims as { email?: string }).email ?? "").toLowerCase();
    return { isSupport: isSupportEmail(email) };
  });

/** An employee sends a message to Huri support. */
export const sendHelpMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ body: z.string().trim().min(1).max(4000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("profiles").select("full_name, nickname, role_name, email, dealership_id").eq("id", userId).maybeSingle();
    if (!me) throw new Error("Profile not found");
    const { data: dealer } = await supabase
      .from("dealerships").select("name, company_code").eq("id", me.dealership_id).maybeSingle();
    const name = me.nickname || me.full_name;

    const { data: existing } = await supabase
      .from("help_threads").select("id").eq("user_id", userId).eq("hidden_by_user", false)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    let threadId = existing?.id;
    if (!threadId) {
      const { data: t, error } = await supabase.from("help_threads").insert({
        user_id: userId, dealership_id: me.dealership_id,
        company_code: dealer?.company_code ?? "", dealership_name: dealer?.name ?? "",
        user_name: name, user_role: me.role_name, user_email: me.email,
      }).select("id").single();
      if (error) throw error;
      threadId = t.id;
    }
    const { data: msg, error: msgErr } = await supabase.from("help_messages")
      .insert({ thread_id: threadId, sender_type: "user", sender_id: userId, body: data.body })
      .select("id").single();
    if (msgErr) throw msgErr;
    const now = new Date().toISOString();
    await supabase.from("help_threads").update({ last_message_at: now, user_read_at: now, status: "open" }).eq("id", threadId);

    // Notify support only — email and push to Aron's devices.
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      await sendTemplateEmail("help-request", SUPPORT_EMAIL, {
        templateData: { userName: name, role: me.role_name, dealershipName: dealer?.name ?? "", companyCode: dealer?.company_code ?? "", message: data.body },
        idempotencyKey: `help-request-${msg.id}`,
      });
    } catch (e) { console.error("help email failed", (e as Error).message); }
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: support } = await supabaseAdmin.from("profiles").select("id").in("email", SUPPORT_ACCOUNTS);
      for (const s of support ?? []) {
        await pushToUser(s.id, {
          title: `Help Request · ${dealer?.company_code ?? ""}`,
          body: `${name} (${me.role_name}): ${snippet(data.body)}`,
          url: "/help", tag: `help-${threadId}`, variant: "default",
        });
      }
    } catch (e) { console.error("help push failed", (e as Error).message); }
    return { threadId };
  });

/** Huri support replies; the employee sees it as coming from "Huri". */
export const sendSupportReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ threadId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).parse(d))
  .handler(async ({ data, context }) => {
    const email = String((context.claims as { email?: string }).email ?? "").toLowerCase();
    if (!isSupportEmail(email)) throw new Error("Not allowed");
    const { supabase, userId } = context;
    const { data: thread } = await supabase.from("help_threads").select("id, user_id").eq("id", data.threadId).maybeSingle();
    if (!thread) throw new Error("Conversation not found");
    const { error } = await supabase.from("help_messages")
      .insert({ thread_id: thread.id, sender_type: "support", sender_id: userId, body: data.body });
    if (error) throw error;
    const now = new Date().toISOString();
    await supabase.from("help_threads").update({ last_message_at: now, support_read_at: now }).eq("id", thread.id);
    try {
      await pushToUser(thread.user_id, { title: "Huri", body: `Huri: ${snippet(data.body)}`, url: "/help", tag: `help-${thread.id}`, variant: "default" });
    } catch (e) { console.error("help reply push failed", (e as Error).message); }
    return { ok: true };
  });

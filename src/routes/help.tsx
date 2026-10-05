import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BottomBar } from "@/components/BottomBar";
import { getHelpIdentity, sendHelpMessage, sendSupportReply } from "@/lib/help.functions";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help · Huri" },
      { name: "description", content: "Contact Huri support about any problem with the app." },
      { property: "og:title", content: "Help · Huri" },
      { property: "og:description", content: "Contact Huri support about any problem with the app." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpPage,
});

type Thread = {
  id: string; user_id: string; company_code: string; dealership_name: string;
  user_name: string; user_role: string; last_message_at: string;
  support_read_at: string | null; user_read_at: string | null; hidden_by_user: boolean;
};
type Msg = { id: string; thread_id: string; sender_type: string; body: string; created_at: string };

function HelpPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const identity = useServerFn(getHelpIdentity);
  const [isSupport, setIsSupport] = useState<boolean | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [userThread, setUserThread] = useState<string | null | undefined>(undefined);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);
  useEffect(() => {
    if (!user) return;
    identity().then((r) => setIsSupport(r.isSupport)).catch(() => setIsSupport(false));
  }, [user, identity]);

  useEffect(() => {
    if (!user || isSupport !== false) return;
    supabase.from("help_threads").select("id")
      .eq("user_id", user.id).eq("hidden_by_user", false)
      .order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setUserThread(data?.id ?? null));
  }, [user, isSupport]);

  const clear = async () => {
    if (!userThread) return;
    if (!confirm("Delete this chat? Your conversation history will be cleared.")) return;
    await supabase.from("help_threads").update({ hidden_by_user: true }).eq("id", userThread);
    setUserThread(null);
    toast.success("Chat deleted");
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface safe-top pb-20">
      <header className="sticky top-0 z-10 grid grid-cols-[2.5rem_1fr_2.5rem] items-center border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
        {isSupport && openThread ? (
          <button onClick={() => setOpenThread(null)} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full text-primary"><ArrowLeft className="h-5 w-5" /></button>
        ) : (
          <Link to="/profile" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full text-primary"><ArrowLeft className="h-5 w-5" /></Link>
        )}
        <h1 className="text-center text-base font-semibold">Huri Support</h1>
        {isSupport === false && userThread ? (
          <button onClick={clear} aria-label="Delete chat" className="grid h-9 w-9 place-items-center justify-self-end rounded-full text-destructive"><Trash2 className="h-5 w-5" /></button>
        ) : <span />}
      </header>
      {isSupport === null ? null : isSupport ? (
        openThread ? <Conversation threadId={openThread} support /> : <SupportInbox onOpen={setOpenThread} />
      ) : userThread === undefined ? null : (
        <Conversation threadId={userThread} onCreated={setUserThread} />
      )}
      <BottomBar active="profile" />
    </div>
  );
}

function Conversation({ threadId, support, onCreated }: { threadId: string | null; support?: boolean; onCreated?: (id: string) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const sendUser = useServerFn(sendHelpMessage);
  const sendReply = useServerFn(sendSupportReply);

  const load = useCallback(async () => {
    if (!threadId) { setMsgs([]); return; }
    const { data } = await supabase.from("help_messages").select("*").eq("thread_id", threadId).order("created_at");
    setMsgs((data as Msg[]) ?? []);
    const now = new Date().toISOString();
    await supabase.from("help_threads").update(support ? { support_read_at: now } : { user_read_at: now }).eq("id", threadId);
  }, [threadId, support]);

  useEffect(() => {
    load();
    if (!threadId) return;
    const ch = supabase.channel(`help-${threadId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "help_messages", filter: `thread_id=eq.${threadId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [threadId, load]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      if (support && threadId) await sendReply({ data: { threadId, body } });
      else {
        const r = await sendUser({ data: { body } });
        if (r.threadId !== threadId) onCreated?.(r.threadId);
      }
      setText("");
      await load();
    } catch (err) {
      toast.error((err as Error).message || "Could not send");
    } finally { setBusy(false); }
  };

  return (
    <>
      <main className="flex-1 space-y-2 overflow-y-auto p-4">
        {msgs.length === 0 && !support && (
          <p className="pt-6 text-center text-sm text-muted-foreground">Send a message and Huri will reply right here.</p>
        )}
        {msgs.map((m) => {
          const mine = support ? m.sender_type === "support" : m.sender_type === "user";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-background border border-border"}`}>
                {!mine && m.sender_type === "support" && <p className="mb-0.5 text-xs font-semibold text-primary">Huri</p>}
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{format(new Date(m.created_at), "MMM d, h:mm a")}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </main>
      <form onSubmit={send} className="sticky bottom-16 flex items-end gap-2 border-t border-border bg-background p-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={4000}
          placeholder={support ? "Reply as Huri…" : "Describe the problem…"}
          className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-base outline-none focus:border-primary" />
        <button disabled={busy || !text.trim()} aria-label="Send" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50">
          <Send className="h-5 w-5" />
        </button>
      </form>
    </>
  );
}

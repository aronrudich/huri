import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Paperclip, Send, Trash2, X, Film } from "lucide-react";
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
type Att = { path: string; type: "image" | "video"; name: string };
type Msg = { id: string; thread_id: string; sender_type: string; body: string; created_at: string; attachments: Att[] | null };
type Pending = { id: string; file: File; preview: string; type: "image" | "video"; path?: string };

function AttachmentView({ att, onZoom }: { att: Att; onZoom: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage.from("help-attachments").createSignedUrl(att.path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [att.path]);
  if (!url) return <div className="h-32 w-40 animate-pulse rounded-lg bg-muted" />;
  if (att.type === "video") return <video src={url} controls playsInline preload="metadata" className="max-h-64 max-w-full rounded-lg" />;
  return <button type="button" onClick={() => onZoom(url)}><img src={url} alt={att.name} className="max-h-64 max-w-full rounded-lg object-cover" /></button>;
}

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
  const [pending, setPending] = useState<Pending[]>([]);
  const [zoom, setZoom] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const endRef = useRef<HTMLDivElement>(null);
  const sendUser = useServerFn(sendHelpMessage);
  const sendReply = useServerFn(sendSupportReply);

  const load = useCallback(async () => {
    if (!threadId) { setMsgs([]); return; }
    const { data } = await supabase.from("help_messages").select("*").eq("thread_id", threadId).order("created_at");
    setMsgs((data as unknown as Msg[]) ?? []);
    if (support) {
      const { data: t } = await supabase.from("help_threads").select("user_id").eq("id", threadId).maybeSingle();
      setOwnerId(t?.user_id ?? null);
    }
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
    if (!body && pending.length === 0) return;
    setBusy(true);
    try {
      const folder = support ? ownerId : user?.id;
      if (pending.length && !folder) throw new Error("Could not upload");
      const attachments: Att[] = [];
      for (const p of pending) {
        const ext = p.file.name.split(".").pop() || (p.type === "video" ? "mp4" : "jpg");
        const path = `${folder}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("help-attachments").upload(path, p.file, { contentType: p.file.type });
        if (error) throw new Error("Upload failed: " + error.message);
        attachments.push({ path, type: p.type, name: p.file.name.slice(0, 200) });
      }
      if (support && threadId) await sendReply({ data: { threadId, body, attachments } });
      else {
        const r = await sendUser({ data: { body, attachments } });
        if (r.threadId !== threadId) onCreated?.(r.threadId);
      }
      setText("");
      pending.forEach((p) => URL.revokeObjectURL(p.preview));
      setPending([]);
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
                {(m.attachments ?? []).length > 0 && (
                  <div className="mb-1 space-y-1">{(m.attachments ?? []).map((a) => <AttachmentView key={a.path} att={a} onZoom={setZoom} />)}</div>
                )}
                {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                <p className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{format(new Date(m.created_at), "MMM d, h:mm a")}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </main>
      {zoom && (
        <button type="button" onClick={() => setZoom(null)} aria-label="Close" className="fixed inset-0 z-50 grid place-items-center bg-foreground/90 p-4">
          <img src={zoom} alt="" className="max-h-full max-w-full object-contain" />
        </button>
      )}
      <form onSubmit={send} className="sticky bottom-16 border-t border-border bg-background p-3">
        {pending.length > 0 && (
          <div className="mb-2 flex gap-2 overflow-x-auto">
            {pending.map((p) => (
              <div key={p.id} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                {p.type === "image" ? <img src={p.preview} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center"><Film className="h-6 w-6 text-muted-foreground" /></div>}
                <button type="button" aria-label="Remove" onClick={() => setPending((l) => l.filter((x) => x.id !== p.id))} className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-background/90"><X className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          const tooBig = files.filter((f) => f.size > 50 * 1024 * 1024);
          if (tooBig.length) toast.error("Files must be under 50 MB");
          const ok = files.filter((f) => f.size <= 50 * 1024 * 1024 && (f.type.startsWith("image/") || f.type.startsWith("video/")));
          setPending((l) => [...l, ...ok.map((f) => ({ id: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f), type: (f.type.startsWith("video/") ? "video" : "image") as "image" | "video" }))].slice(0, 10));
        }} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} aria-label="Attach photo or video" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border text-primary disabled:opacity-50">
          <Paperclip className="h-5 w-5" />
        </button>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={4000}
          placeholder={support ? "Reply as Huri…" : "Describe the problem…"}
          className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-base outline-none focus:border-primary" />
        <button disabled={busy || (!text.trim() && pending.length === 0)} aria-label="Send" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50">
          <Send className="h-5 w-5" />
        </button>
        </div>
      </form>
    </>
  );
}

function SupportInbox({ onOpen }: { onOpen: (id: string) => void }) {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.from("help_threads").select("*").order("last_message_at", { ascending: false });
    setThreads((data as Thread[]) ?? []);
  }, []);
  useEffect(() => {
    load();
    const ch = supabase.channel("help-inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "help_messages" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);
  return (
    <main className="flex-1 p-4">
      <h2 className="mb-3 text-lg font-semibold">Help requests</h2>
      {threads?.length === 0 && <p className="text-sm text-muted-foreground">No help requests yet.</p>}
      <ul className="space-y-2">
        {threads?.map((t) => {
          const unread = !t.support_read_at || new Date(t.support_read_at) < new Date(t.last_message_at);
          return (
            <li key={t.id}>
              <button onClick={() => onOpen(t.id)} className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-left active:bg-accent">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">{t.company_code}</span>
                  <span className="truncate text-sm font-medium">{t.dealership_name}</span>
                  <span className="flex-1" />
                  {unread && <span aria-label="Unread" className="h-2.5 w-2.5 rounded-full bg-destructive" />}
                </div>
                <p className="mt-1 text-sm">{t.user_name} · <span className="text-muted-foreground">{t.user_role}</span></p>
                <p className="text-xs text-muted-foreground">{format(new Date(t.last_message_at), "MMM d, h:mm a")}</p>
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

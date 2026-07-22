import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Send, Trash2, Phone, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { format } from "date-fns";
import { sendMessagePush } from "@/lib/push.functions";
import { getDirectory } from "@/lib/directory.functions";
import { hideThreadForUser, isMessageAfterCutoff, loadThreadCutoffs, loadThreadCutoffsForUser } from "@/lib/thread-visibility";
import { formatPhone } from "@/lib/phone";
import { ProfileViewSheet } from "@/components/ProfileViewSheet";


export const Route = createFileRoute("/thread/$threadId")({
  head: () => ({ meta: [{ title: "Thread · Huri" }] }),
  component: ThreadPage,
});

type Msg = {
  id: string; thread_id: string; sender_id: string | null;
  recipient_id: string | null; recipient_role_id: string | null;
  body: string; created_at: string; read_at?: string | null;
};

function ThreadPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [threadCutoffs, setThreadCutoffs] = useState(() => loadThreadCutoffs());
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    const markRead = async () => {
      const readAt = new Date().toISOString();
      setMsgs((prev) => prev.map((m) => (m.thread_id === threadId && m.sender_id !== user.id && !m.read_at ? { ...m, read_at: readAt } : m)));
      await supabase
        .from("messages")
        .update({ read_at: readAt })
        .eq("thread_id", threadId)
        .is("read_at", null)
        .neq("sender_id", user.id);
    };
    loadThreadCutoffsForUser(user.id).then(setThreadCutoffs);
    supabase.from("messages").select("*").eq("thread_id", threadId).order("created_at", { ascending: true })
      .then(({ data }) => { setMsgs((data as Msg[]) ?? []); void markRead(); });
    getDirectory().then((data) => {
      const m: Record<string, string> = {};
      data?.forEach((p) => { if (p.id) m[p.id] = p.nickname || p.full_name || ""; });
      setProfiles(m);
    });
    supabase.from("roles").select("id, name").then(({ data }) => {
      const m: Record<string, string> = {};
      data?.forEach((r) => { m[r.id] = r.name; });
      setRoles(m);
    });
    const chan = supabase.channel(`thread-${threadId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
        (p) => { setMsgs((prev) => [...prev, p.new as Msg]); void markRead(); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
        (p) => { const upd = p.new as Msg; setMsgs((prev) => prev.map((m) => m.id === upd.id ? upd : m)); })
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [threadId, user]);

  const groupMatch = threadId.match(/^group:([^:]+):([^:]+)$/);
  const isGroup = !!groupMatch;
  const groupRoleId = groupMatch?.[1] ?? null;
  const groupStarterId = groupMatch?.[2] ?? null;
  const visibleMsgs = useMemo(
    () => msgs.filter((m) => isMessageAfterCutoff(m.created_at, threadCutoffs[threadId])),
    [msgs, threadCutoffs, threadId],
  );

  // For 1-on-1 threads (dm:uuid1:uuid2) figure out the other user's id
  // so we can pull their phone number for the tel: call button.
  const otherUserId = useMemo(() => {
    if (isGroup || !user) return null;
    const parts = threadId.split(":");
    if (parts[0] !== "dm" || parts.length < 3) return null;
    return parts[1] === user.id ? parts[2] : parts[1];
  }, [threadId, user, isGroup]);

  const [otherPhone, setOtherPhone] = useState<string | null>(null);
  useEffect(() => {
    if (!otherUserId) { setOtherPhone(null); return; }
    supabase.from("profiles").select("phone_number").eq("id", otherUserId).maybeSingle()
      .then(({ data }) => setOtherPhone((data as { phone_number?: string | null } | null)?.phone_number ?? null));
  }, [otherUserId]);

  const title = isGroup
    ? `${roles[groupRoleId!] ?? "Group"} (group)${groupStarterId && groupStarterId !== user?.id ? ` · started by ${profiles[groupStarterId] ?? "someone"}` : ""}`
    : (() => {
        const last = visibleMsgs[visibleMsgs.length - 1] ?? visibleMsgs[0];
        if (!last) return otherUserId ? (profiles[otherUserId] ?? "Direct message") : "Direct message";
        const otherId = last.sender_id === user?.id ? last.recipient_id : last.sender_id;
        if (!otherId) return "Unknown";
        return profiles[otherId] ?? "Direct message";
      })();

  const send = async () => {
    if (!body.trim() || !user) return;
    setBusy(true);
    const payload: any = {
      thread_id: threadId,
      body: body.trim(),
      sender_id: user.id,
    };
    if (isGroup) payload.recipient_role_id = groupRoleId;
    else {
      // dm:uuid1:uuid2  → other id
      const parts = threadId.split(":");
      const other = parts[1] === user.id ? parts[2] : parts[1];
      payload.recipient_id = other;
    }
    const { error } = await supabase.from("messages").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    sendMessagePush({
      data: {
        threadId,
        body: body.trim(),
        recipientId: payload.recipient_id ?? null,
        recipientRoleId: payload.recipient_role_id ?? null,
        isAnonymous: false,
      },
    }).catch((e) => console.warn("msg push failed", e));
    setBody("");
  };

  useEffect(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: "end" });
    });
  }, [visibleMsgs.length]);

  return (
    <div className="flex min-h-screen flex-col bg-surface safe-top">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Link to="/" className="grid h-8 w-8 place-items-center rounded-full text-primary"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="flex-1 truncate text-center text-base font-semibold">{title}</h1>
        {!isGroup && otherUserId && (
          <button
            type="button"
            onClick={() => setShowProfile(true)}
            aria-label="View profile"
            className="grid h-8 w-8 place-items-center rounded-full text-primary hover:bg-primary/10"
          >
            <User className="h-5 w-5" />
          </button>
        )}
        {!isGroup && otherPhone && (
          <a
            href={`tel:${otherPhone}`}
            aria-label={`Call ${formatPhone(otherPhone)}`}
            title={`Call ${formatPhone(otherPhone)}`}
            className="grid h-8 w-8 place-items-center rounded-full text-primary hover:bg-primary/10"
          >
            <Phone className="h-5 w-5" />
          </a>
        )}
        <button
          type="button"
          onClick={async () => {
            if (!user) return;
            if (!window.confirm("Delete this conversation? It will be removed from your inbox.")) return;
            try {
              await hideThreadForUser(user.id, threadId, new Date().toISOString());
              navigate({ to: "/", replace: true });
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
          aria-label="Delete conversation"
          className="hidden h-8 w-8 place-items-center rounded-full text-destructive hover:bg-destructive/10 sm:grid"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </header>


      <ol className="flex-1 space-y-2 px-3 py-4">
        {visibleMsgs.map((m) => {
          const mine = m.sender_id === user?.id;
          const senderLabel = m.sender_id ? (profiles[m.sender_id] ?? "Unknown") : "Unknown";
          return (
            <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[15px] ${
                mine ? "bg-primary text-primary-foreground" : "bg-background"
              }`}>
                {!mine && isGroup && (
                  <p className="mb-0.5 text-[11px] font-semibold text-primary">
                    {senderLabel}
                  </p>
                )}
                <p className="whitespace-pre-wrap leading-snug">{m.body}</p>
                <p className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {format(new Date(m.created_at), "p")}
                </p>
              </div>
            </li>
          );
        })}
        <div ref={bottomRef} />
      </ol>

      <div className="sticky bottom-0 border-t border-border bg-background p-3 safe-bottom">
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message…"
            className="flex-1 resize-none rounded-2xl border border-input bg-background px-3 py-2 text-base outline-none focus:border-primary"
          />
          <button
            onClick={send} disabled={!body.trim() || busy}
            className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

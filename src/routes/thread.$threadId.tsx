import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Send, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/thread/$threadId")({
  head: () => ({ meta: [{ title: "Thread · Huri" }] }),
  component: ThreadPage,
});

type Msg = {
  id: string; thread_id: string; sender_id: string | null;
  recipient_id: string | null; recipient_role_id: string | null;
  body: string; is_anonymous: boolean; created_at: string;
};

function ThreadPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("messages").select("*").eq("thread_id", threadId).order("created_at", { ascending: true })
      .then(({ data }) => setMsgs((data as Msg[]) ?? []));
    supabase.from("directory").select("id, full_name, nickname").then(({ data }) => {
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
        (p) => setMsgs((prev) => [...prev, p.new as Msg]))
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [threadId, user]);

  const isGroup = threadId.startsWith("group:");
  const title = isGroup
    ? `${roles[threadId.slice(6)] ?? "Group"} (broadcast)`
    : (() => {
        const last = msgs[msgs.length - 1] ?? msgs[0];
        if (!last) return "Direct message";
        const otherId = last.sender_id === user?.id ? last.recipient_id : last.sender_id;
        if (!otherId) return "Anonymous";
        return profiles[otherId] ?? "Direct message";
      })();

  const send = async () => {
    if (!body.trim() || !user) return;
    setBusy(true);
    const payload: any = {
      thread_id: threadId,
      body: body.trim(),
      is_anonymous: anonymous,
      sender_id: anonymous ? null : user.id,
    };
    if (isGroup) payload.recipient_role_id = threadId.slice(6);
    else {
      // dm:uuid1:uuid2  → other id
      const parts = threadId.split(":");
      const other = parts[1] === user.id ? parts[2] : parts[1];
      payload.recipient_id = other;
    }
    const { error } = await supabase.from("messages").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    setBody("");
    setAnonymous(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface safe-top">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Link to="/" className="grid h-8 w-8 place-items-center rounded-full text-primary"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="flex-1 truncate text-center text-base font-semibold">{title}</h1>
        <div className="w-8" />
      </header>

      <ol className="flex-1 space-y-2 px-3 py-4">
        {msgs.map((m) => {
          const mine = m.sender_id === user?.id;
          const senderLabel = m.is_anonymous
            ? "Anonymous"
            : m.sender_id ? (profiles[m.sender_id] ?? "Unknown") : "Anonymous";
          return (
            <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[15px] ${
                mine ? "bg-primary text-primary-foreground" : "bg-background"
              }`}>
                {(!mine && (isGroup || m.is_anonymous)) && (
                  <p className={`mb-0.5 text-[11px] font-semibold ${m.is_anonymous ? "text-muted-foreground" : "text-primary"}`}>
                    {senderLabel}{m.is_anonymous && " 🕶"}
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
      </ol>

      <div className="sticky bottom-0 border-t border-border bg-background p-3 safe-bottom">
        <label className="mb-2 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
          Send anonymously
        </label>
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

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, PenSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BottomBar, HuriLogo } from "@/components/BottomBar";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Inbox · Huri" },
      { name: "description", content: "Your Huri inbox — direct messages and group broadcasts." },
    ],
  }),
  component: InboxPage,
});

type Msg = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  recipient_id: string | null;
  recipient_role_id: string | null;
  body: string;
  is_anonymous: boolean;
  created_at: string;
};

type ThreadSummary = {
  thread_id: string;
  title: string;
  preview: string;
  at: string;
  isGroup: boolean;
  unread?: boolean;
};

function InboxPage() {
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name: string }>>({});
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  // load profiles + roles maps
  useEffect(() => {
    if (!user) return;
    supabase.from("directory").select("id, full_name, nickname").then(({ data }) => {
      if (data) {
        const m: Record<string, { name: string }> = {};
        data.forEach((p) => { m[p.id] = { name: p.nickname || p.full_name }; });
        setProfiles(m);
      }
    });
    supabase.from("roles").select("id, name").then(({ data }) => {
      if (data) {
        const m: Record<string, string> = {};
        data.forEach((r) => { m[r.id] = r.name; });
        setRoles(m);
      }
    });
  }, [user]);

  // load messages relevant to me
  useEffect(() => {
    if (!user || !profile) return;
    const myRole = profile.role_id;
    const filter = myRole
      ? `recipient_id.eq.${user.id},sender_id.eq.${user.id},recipient_role_id.eq.${myRole}`
      : `recipient_id.eq.${user.id},sender_id.eq.${user.id}`;
    supabase
      .from("messages")
      .select("*")
      .or(filter)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => { if (data) setMessages(data as Msg[]); });

    const chan = supabase
      .channel("inbox-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Msg;
        const mine =
          m.recipient_id === user.id ||
          m.sender_id === user.id ||
          (myRole && m.recipient_role_id === myRole);
        if (mine) setMessages((prev) => [m, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [user, profile]);

  const threads = useMemo<ThreadSummary[]>(() => {
    const map = new Map<string, ThreadSummary>();
    for (const m of messages) {
      if (map.has(m.thread_id)) continue;
      const isGroup = m.thread_id.startsWith("group:");
      let title: string;
      if (isGroup) {
        const rid = m.thread_id.slice(6);
        title = `${roles[rid] ?? "Group"} (broadcast)`;
      } else {
        const otherId = m.sender_id === user?.id ? m.recipient_id : m.sender_id;
        if (m.is_anonymous && m.sender_id !== user?.id) {
          title = "Anonymous";
        } else if (otherId) {
          title = profiles[otherId]?.name ?? "Unknown";
        } else {
          title = "Anonymous";
        }
      }
      map.set(m.thread_id, {
        thread_id: m.thread_id,
        title,
        preview: m.body,
        at: m.created_at,
        isGroup,
      });
    }
    let arr = Array.from(map.values());
    if (q.trim()) {
      const needle = q.toLowerCase();
      arr = arr.filter((t) => t.title.toLowerCase().includes(needle) || t.preview.toLowerCase().includes(needle));
    }
    return arr;
  }, [messages, profiles, roles, user, q]);

  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-surface pb-32 safe-top">
      <header className="sticky top-0 z-10 bg-surface/95 px-5 pb-3 pt-4 backdrop-blur">
        <div className="mb-3 flex items-center"><HuriLogo /></div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="w-full rounded-xl bg-muted py-2.5 pl-9 pr-3 text-base outline-none placeholder:text-muted-foreground"
          />
        </div>
      </header>

      <ul className="divide-y divide-border bg-background">
        {threads.length === 0 && (
          <li className="px-5 py-16 text-center text-sm text-muted-foreground">
            No messages yet. Tap the blue compose button to send one.
          </li>
        )}
        {threads.map((t) => (
          <li key={t.thread_id}>
            <Link
              to="/thread/$threadId"
              params={{ threadId: t.thread_id }}
              className="flex items-start gap-3 px-5 py-3 active:bg-accent"
            >
              <div className={`mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold ${t.isGroup ? "bg-accent text-accent-foreground" : "bg-primary/10 text-primary"}`}>
                {t.isGroup ? "👥" : t.title[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-base font-semibold">{t.title}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(t.at), { addSuffix: false })}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{t.preview}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Compose FAB (bottom-right) */}
      <Link
        to="/compose"
        className="fixed bottom-24 right-5 z-20 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95"
        aria-label="Compose"
      >
        <PenSquare className="h-6 w-6" />
      </Link>

      <BottomBar active="inbox" />
    </div>
  );
}


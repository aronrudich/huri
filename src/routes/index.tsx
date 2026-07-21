import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, PenSquare, Phone, MessageSquare, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getDirectory, getMessageRecipients } from "@/lib/directory.functions";
import { useAuth } from "@/lib/auth-context";
import { BottomBar, HuriLogo, TopActions } from "@/components/BottomBar";
import { SwipeRow } from "@/components/SwipeRow";
import { formatDistanceToNow } from "date-fns";
import { formatPhone } from "@/lib/phone";
import { hideThreadForUser, isMessageAfterCutoff, loadThreadCutoffs, loadThreadCutoffsForUser, mergeThreadCutoffs, saveThreadCutoffs, type ThreadCutoffs } from "@/lib/thread-visibility";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Huri" },
      { name: "description", content: "Huri - Lot Management" },
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
  created_at: string;
  read_at?: string | null;
};

type ThreadSummary = {
  thread_id: string;
  title: string;
  preview: string;
  at: string;
  isGroup: boolean;
  unread?: boolean;
};

type PersonHit = { id: string; name: string; phone: string | null };

function InboxPage() {
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name: string }>>({});
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<PersonHit[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<PersonHit | null>(null);
  const [threadCutoffs, setThreadCutoffs] = useState<ThreadCutoffs>(() => loadThreadCutoffs());

  const hideThread = (tid: string, latestAt: string) => {
    if (!user) return;
    const next = mergeThreadCutoffs(threadCutoffs, { [tid]: latestAt });
    setThreadCutoffs(next);
    saveThreadCutoffs(next);
    hideThreadForUser(user.id, tid, latestAt).catch((error) => {
      console.warn("[inbox] failed to sync deleted thread", error);
    });
  };

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    loadThreadCutoffsForUser(user.id).then(setThreadCutoffs);
    const chan = supabase
      .channel(`thread-hides-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "thread_hides", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = (payload.new || payload.old) as { thread_id?: string; hidden_at?: string };
          if (!row.thread_id || !row.hidden_at) return;
          setThreadCutoffs((prev) => {
            const next = mergeThreadCutoffs(prev, { [row.thread_id!]: row.hidden_at! });
            saveThreadCutoffs(next);
            return next;
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [user]);

  // load profiles + roles maps
  useEffect(() => {
    if (!user) return;
    getDirectory().then((data) => {
      if (data) {
        const m: Record<string, { name: string }> = {};
        data.forEach((p) => { if (p.id) m[p.id] = { name: p.nickname || p.full_name || "" }; });
        setProfiles(m);
      }
    });
    getMessageRecipients().then((data) => {
      if (data) {
        setPeople(data.map((p) => ({
          id: p.id,
          name: `${p.nickname || p.fullName}${p.roleName ? ` (${p.roleName})` : ""}`,
          phone: p.phoneNumber ?? null,
        })));
      }
    }).catch(() => {});
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
    // Include our own role; if we're Valet & Parts, also include the Valet role id.
    const valetRoleId = Object.entries(roles).find(([, name]) => name === "Valet")?.[0];
    const myRoleIds = new Set<string>();
    if (profile.role_id) myRoleIds.add(profile.role_id);
    if (profile.role_name === "Valet & Parts" && valetRoleId) myRoleIds.add(valetRoleId);

    const parts = [
      `recipient_id.eq.${user.id}`,
      `sender_id.eq.${user.id}`,
      // Group threads that we started (as anyone with any role): group:*:<myId>
      `thread_id.like.group:*:${user.id}`,
    ];
    if (myRoleIds.size) {
      parts.push(`recipient_role_id.in.(${Array.from(myRoleIds).join(",")})`);
    }
    const filter = parts.join(",");

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
        const groupMatch = m.thread_id.match(/^group:([^:]+):([^:]+)$/);
        const iStarted = !!groupMatch && groupMatch[2] === user.id;
        const mine =
          m.recipient_id === user.id ||
          m.sender_id === user.id ||
          (m.recipient_role_id && myRoleIds.has(m.recipient_role_id)) ||
          iStarted;
        if (mine) setMessages((prev) => [m, ...prev]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const upd = payload.new as Msg;
        setMessages((prev) => prev.map((m) => m.id === upd.id ? upd : m));
      })
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [user, profile, roles]);


  const threads = useMemo<ThreadSummary[]>(() => {
    const map = new Map<string, ThreadSummary>();
    const unreadByThread = new Map<string, boolean>();
    for (const m of messages) {
      if (!isMessageAfterCutoff(m.created_at, threadCutoffs[m.thread_id])) continue;
      if (map.has(m.thread_id)) continue;
      const groupMatch = m.thread_id.match(/^group:([^:]+):([^:]+)$/);
      const isGroup = !!groupMatch;
      let title: string;
      if (groupMatch) {
        const [, rid, starterId] = groupMatch;
        const roleName = roles[rid] ?? "Group";
        if (starterId === user?.id) {
          title = `${roleName} (group)`;
        } else {
          const starterName = profiles[starterId]?.name ?? "someone";
          title = `${roleName} (group) · ${starterName}`;
        }
      } else if (m.thread_id.startsWith("group:")) {
        title = `${roles[m.thread_id.slice(6)] ?? "Group"} (group)`;
      } else {
        const otherId = m.sender_id === user?.id ? m.recipient_id : m.sender_id;
        title = otherId ? (profiles[otherId]?.name ?? "Unknown") : "Unknown";
      }
      map.set(m.thread_id, {
        thread_id: m.thread_id,
        title,
        preview: m.body,
        at: m.created_at,
        isGroup,
      });
    }
    for (const m of messages) {
      if (!isMessageAfterCutoff(m.created_at, threadCutoffs[m.thread_id])) continue;
      if (m.sender_id !== user?.id && !m.read_at) {
        unreadByThread.set(m.thread_id, true);
      }
    }
    let arr = Array.from(map.values()).map((t) => ({ ...t, unread: unreadByThread.get(t.thread_id) === true }));
    if (q.trim()) {
      const needle = q.toLowerCase();
      arr = arr.filter((t) => t.title.toLowerCase().includes(needle) || t.preview.toLowerCase().includes(needle));
    }
    return arr;
  }, [messages, profiles, roles, user, q, threadCutoffs]);

  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-surface pb-32 safe-top">
      <header className="sticky top-0 z-10 bg-surface/95 px-5 pb-3 pt-4 backdrop-blur">
        <div className="mb-3 flex items-center gap-2"><HuriLogo /><div className="flex-1" /><TopActions /></div>
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
            <SwipeRow onDelete={() => hideThread(t.thread_id, t.at)}>
              <Link
                to="/thread/$threadId"
                params={{ threadId: t.thread_id }}
                className="flex items-start gap-2 px-3 py-3 active:bg-accent"
              >
                <span
                  aria-label={t.unread ? "Unread" : undefined}
                  className={`mt-4 h-2 w-2 shrink-0 rounded-full ${t.unread ? "bg-primary" : "bg-transparent"}`}
                />
                <div className={`mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold ${t.isGroup ? "bg-accent text-accent-foreground" : "bg-primary/10 text-primary"}`}>
                  {t.isGroup ? "👥" : t.title[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`truncate text-base ${t.unread ? "font-bold" : "font-semibold"}`}>{t.title}</p>
                    <span className={`shrink-0 text-xs ${t.unread ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                      {formatDistanceToNow(new Date(t.at), { addSuffix: false })}
                    </span>
                  </div>
                  <p className={`line-clamp-2 text-sm ${t.unread ? "font-medium text-foreground" : "text-muted-foreground"}`}>{t.preview}</p>
                </div>
              </Link>
            </SwipeRow>
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


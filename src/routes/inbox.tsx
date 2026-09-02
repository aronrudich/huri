import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, PenSquare, MessageSquare, X, User, Car } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeGeneration, handleChannelStatus } from "@/lib/realtime-recovery";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { searchCars } from "@/lib/directory.functions";
import { directoryQuery, formatRecipient, messageRecipientsQuery, messagesQuery, rolesQuery } from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { isSpectatorRole } from "@/lib/roles";
import { BottomBar, HuriLogo, TopActions } from "@/components/BottomBar";
import { SwipeRow } from "@/components/SwipeRow";
import { ProfileViewSheet } from "@/components/ProfileViewSheet";
import { Avatar, AvatarViewer } from "@/components/Avatar";
import { ListSkeleton } from "@/components/ListSkeleton";
import { normalizeSpot, spotBadge } from "@/lib/lot";

import { formatDistanceToNow } from "date-fns";
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
  avatarUrl?: string | null;
};


type PersonHit = { id: string; name: string; avatarUrl: string | null };
type CarHit = { id: string; ro_number: string | null; car_model: string | null; lot_position: string };

function InboxPage() {
  // Bumped when the app returns from the background so channels rebuild.
  const realtimeGen = useRealtimeGeneration();
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const queryClient = useQueryClient();

  const [q, setQ] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<PersonHit | null>(null);
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null);
  const [carHits, setCarHits] = useState<CarHit[]>([]);
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
      .subscribe(handleChannelStatus);
    return () => { supabase.removeChannel(chan); };
  }, [user, realtimeGen]);

  // Directory / recipients / roles are cached by React Query, so revisits paint
  // instantly instead of refetching from scratch on every mount.
  const { data: profiles = {} } = useQuery({ ...directoryQuery(), enabled: !!user });
  const { data: people = [], error: peopleError } = useQuery({
    ...messageRecipientsQuery(),
    enabled: !!user,
    select: (rows) => rows.map(formatRecipient),
  });
  const { data: roles = {} } = useQuery({ ...rolesQuery(), enabled: !!user });

  useEffect(() => {
    if (peopleError) console.warn("[inbox] failed to load message recipients", peopleError);
  }, [peopleError]);

  // Role-addressed threads we belong to.
  const myRoleIds = useMemo(() => {
    const ids = new Set<string>();
    if (profile?.role_id) ids.add(profile.role_id);
    return ids;
  }, [profile?.role_id]);

  // Messages live in the query cache, so returning to the inbox paints the
  // previous list instantly instead of starting empty and refetching.
  const messagesOptions = useMemo(
    () => messagesQuery(user?.id ?? "", Array.from(myRoleIds)),
    [user?.id, myRoleIds],
  );
  const {
    data: messages = [],
    isPending: messagesPending,
    error: messagesError,
  } = useQuery({ ...messagesOptions, enabled: !!user && !!profile });

  useEffect(() => {
    if (messagesError) console.warn("[inbox] failed to load messages", messagesError);
  }, [messagesError]);

  const messagesKey = messagesOptions.queryKey;
  const patchMessages = (updater: (cur: Msg[]) => Msg[]) => {
    queryClient.setQueryData<Msg[]>(messagesKey, (cur) => updater(cur ?? []));
  };

  useEffect(() => {
    if (!user || !profile) return;
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
        if (mine) patchMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [m, ...prev]));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const upd = payload.new as Msg;
        patchMessages((prev) => prev.map((m) => (m.id === upd.id ? upd : m)));
      })
      .subscribe(handleChannelStatus);
    return () => { supabase.removeChannel(chan); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, myRoleIds, queryClient, realtimeGen]);



  const threads = useMemo<ThreadSummary[]>(() => {
    const map = new Map<string, ThreadSummary>();
    const unreadByThread = new Map<string, boolean>();
    for (const m of messages) {
      if (!isMessageAfterCutoff(m.created_at, threadCutoffs[m.thread_id])) continue;
      if (map.has(m.thread_id)) continue;
      const groupMatch = m.thread_id.match(/^group:([^:]+):([^:]+)$/);
      const isGroup = !!groupMatch;
      let title: string;
      let avatarUrl: string | null = null;
      if (groupMatch) {
        const [, rid, starterId] = groupMatch;
        const roleName = roles[rid] ?? "Group";
        if (starterId === user?.id) {
          title = `${roleName} (group)`;
        } else {
          const starterName = profiles[starterId]?.name ?? "someone";
          title = `${roleName} (group) · ${starterName}`;
        }
      } else if (m.thread_id.startsWith("huri:")) {
        title = "Huri";
      } else if (m.thread_id.startsWith("group:")) {
        title = `${roles[m.thread_id.slice(6)] ?? "Group"} (group)`;
      } else {
        const otherId = m.sender_id === user?.id ? m.recipient_id : m.sender_id;
        title = otherId ? (profiles[otherId]?.name ?? "Unknown") : "Unknown";
        avatarUrl = otherId ? (profiles[otherId]?.avatarUrl ?? null) : null;
      }

      map.set(m.thread_id, {
        thread_id: m.thread_id,
        title,
        preview: m.body,
        at: m.created_at,
        isGroup,
        avatarUrl,
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

  const filteredPeople = useMemo<PersonHit[]>(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return people.filter((p) => p.name.toLowerCase().includes(needle)).slice(0, 20);
  }, [people, q]);

  // Search parked cars by RO#/model/spot as user types.
  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 1) { setCarHits([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      searchCars({ data: { q: needle } })
        .then((rows) => { if (!cancelled) setCarHits((rows ?? []) as CarHit[]); })
        .catch((error) => {
          console.warn("[inbox] car search failed", error);
          if (!cancelled) setCarHits([]);
        });
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  const openMessage = (personId: string) => {
    if (!user) return;
    const ids = [user.id, personId].sort();
    const tid = `dm:${ids[0]}:${ids[1]}`;
    setSelectedPerson(null);
    navigate({ to: "/thread/$threadId", params: { threadId: tid } });
  };

  // Cold start: show the real Huri frame with placeholder rows instead of a
  // bare "Loading…" screen, so the first paint already looks like the app.
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-surface pb-32 safe-top">
        <header className="sticky top-0 z-10 bg-surface/95 px-5 pb-3 pt-4 backdrop-blur">
          <div className="mb-3 flex items-center gap-2"><HuriLogo /></div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <div className="h-10 w-full rounded-xl bg-muted" />
          </div>
        </header>
        <ListSkeleton rows={7} />
        <BottomBar active="inbox" />
      </div>
    );
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
            placeholder="Search RO#"
            className="w-full rounded-xl bg-muted py-2.5 pl-9 pr-3 text-base outline-none placeholder:text-muted-foreground"
          />
        </div>
      </header>

      {filteredPeople.length > 0 && (
        <div className="border-b border-border bg-background">
          <h2 className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">People</h2>
          <ul>
            {filteredPeople.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setSelectedPerson(p)}
                  className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 active:bg-accent"
                >
                  <Avatar url={p.avatarUrl} name={p.name} size={36} onExpand={(url, name) => setPhoto({ url, name })} />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium">{p.name}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {carHits.length > 0 && (
        <div className="border-b border-border bg-background">
          <h2 className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cars</h2>
          <ul>
            {carHits.map((c) => (
              <li key={c.id}>
                <Link
                  to="/park"
                  search={{ id: c.id }}
                  className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 active:bg-accent"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-[11px] font-bold leading-none tracking-tight text-primary">
                    {c.lot_position ? <span className="whitespace-nowrap">{spotBadge(c.lot_position)}</span> : <Car className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium">
                      {c.ro_number ? `RO #${c.ro_number}` : "No RO #"}
                      {c.car_model && <span className="text-muted-foreground"> · {c.car_model}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {normalizeSpot(c.lot_position) === "UNKNOWN" || !c.lot_position
                        ? "Spot unknown"
                        : `Spot ${normalizeSpot(c.lot_position)}`}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {messagesPending && threads.length === 0 && <ListSkeleton rows={7} />}

      <ul className="divide-y divide-border bg-background">
        {!messagesPending && threads.length === 0 && (
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
                {t.isGroup ? (
                  <div className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">👥</div>
                ) : (
                  <div className="mt-1">
                    <Avatar url={t.avatarUrl} name={t.title} size={40} onExpand={(url, name) => setPhoto({ url, name })} />
                  </div>
                )}

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

      {/* Compose FAB (bottom-right) — spectators are read-only. */}
      {!isSpectatorRole(profile?.role_name) && (
        <Link
          to="/compose"
          className="fixed bottom-24 right-5 z-20 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95"
          aria-label="Compose"
        >
          <PenSquare className="h-6 w-6" />
        </Link>
      )}

      {selectedPerson && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedPerson(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start gap-3">
              <Avatar url={selectedPerson.avatarUrl} name={selectedPerson.name} size={44} onExpand={(url, name) => setPhoto({ url, name })} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">{selectedPerson.name}</p>
              </div>
              <button
                onClick={() => setSelectedPerson(null)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => openMessage(selectedPerson.id)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
              >
                <MessageSquare className="h-4 w-4" /> Message
              </button>
              <button
                onClick={() => { const id = selectedPerson.id; setSelectedPerson(null); setViewProfileId(id); }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-semibold text-secondary-foreground"
              >
                <User className="h-4 w-4" /> Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {viewProfileId && (
        <ProfileViewSheet userId={viewProfileId} onClose={() => setViewProfileId(null)} />
      )}

      {photo && <AvatarViewer url={photo.url} name={photo.name} onClose={() => setPhoto(null)} />}


      <BottomBar active="inbox" />
    </div>
  );
}


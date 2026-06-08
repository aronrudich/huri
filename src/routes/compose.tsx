import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, Users, User as UserIcon, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/compose")({
  head: () => ({ meta: [{ title: "Compose · Huri" }] }),
  component: ComposePage,
});

type Recipient =
  | { kind: "user"; id: string; name: string; subtitle: string }
  | { kind: "group"; id: string; name: string };

function ComposePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [people, setPeople] = useState<Recipient[]>([]);
  const [groups, setGroups] = useState<Recipient[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Recipient | null>(null);
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("profiles").select("id, full_name, nickname, role_name").neq("id", user.id),
      supabase.from("roles").select("id, name").order("name"),
    ]).then(([p, r]) => {
      if (p.data) setPeople(p.data.map((x: any) => ({
        kind: "user", id: x.id, name: x.nickname || x.full_name, subtitle: x.role_name ?? "",
      })));
      if (r.data) setGroups(r.data.map((x: any) => ({ kind: "group", id: x.id, name: x.name })));
    });
  }, [user]);

  const filteredPeople = useMemo(() => {
    if (!q.trim()) return people;
    const n = q.toLowerCase();
    return people.filter((p) => p.name.toLowerCase().includes(n) || (("subtitle" in p) && p.subtitle.toLowerCase().includes(n)));
  }, [people, q]);
  const filteredGroups = useMemo(() => {
    if (!q.trim()) return groups;
    const n = q.toLowerCase();
    return groups.filter((g) => g.name.toLowerCase().includes(n));
  }, [groups, q]);

  const send = async () => {
    if (!selected || !body.trim() || !user) return;
    setBusy(true);
    let thread_id: string;
    const payload: any = {
      body: body.trim(),
      is_anonymous: anonymous,
      sender_id: anonymous ? null : user.id,
    };
    if (selected.kind === "group") {
      thread_id = `group:${selected.id}`;
      payload.recipient_role_id = selected.id;
    } else {
      const ids = [user.id, selected.id].sort();
      thread_id = `dm:${ids[0]}:${ids[1]}`;
      payload.recipient_id = selected.id;
    }
    payload.thread_id = thread_id;
    const { error } = await supabase.from("messages").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(anonymous ? "Sent anonymously" : "Sent");
    navigate({ to: "/thread/$threadId", params: { threadId: thread_id }, replace: true });
  };

  return (
    <div className="min-h-screen bg-surface safe-top safe-bottom">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Link to="/" className="grid h-8 w-8 place-items-center rounded-full text-primary"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="flex-1 text-center text-base font-semibold">New Message</h1>
        <button
          disabled={!selected || !body.trim() || busy}
          onClick={send}
          className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >Send</button>
      </header>

      {!selected ? (
        <div className="px-4 pb-32 pt-3">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="To: Search people or groups"
              className="w-full rounded-xl bg-muted py-2.5 pl-9 pr-3 text-base outline-none placeholder:text-muted-foreground"
            />
          </div>

          {filteredGroups.length > 0 && (
            <>
              <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Groups</h2>
              <ul className="mb-4 overflow-hidden rounded-2xl bg-background">
                {filteredGroups.map((g) => (
                  <li key={g.id}>
                    <button onClick={() => setSelected(g)} className="flex w-full items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 active:bg-accent">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground"><Users className="h-4 w-4" /></div>
                      <span className="flex-1 text-left text-base font-medium">{g.name}</span>
                      <span className="text-xs text-muted-foreground">Broadcast</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">People</h2>
          <ul className="overflow-hidden rounded-2xl bg-background">
            {filteredPeople.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">No matches</li>}
            {filteredPeople.map((p) => (
              <li key={p.id}>
                <button onClick={() => setSelected(p)} className="flex w-full items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 active:bg-accent">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary"><UserIcon className="h-4 w-4" /></div>
                  <div className="flex-1 text-left">
                    <p className="text-base font-medium">{p.name}</p>
                    {"subtitle" in p && p.subtitle && <p className="text-xs text-muted-foreground">{p.subtitle}</p>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="px-4 pt-3">
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-background p-3">
            <div className={`grid h-9 w-9 place-items-center rounded-full ${selected.kind === "group" ? "bg-accent text-accent-foreground" : "bg-primary/10 text-primary"}`}>
              {selected.kind === "group" ? <Users className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">To</p>
              <p className="font-medium">{selected.name}{selected.kind === "group" && " (broadcast)"}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-sm text-primary">Change</button>
          </div>

          <label className="mb-3 flex items-center justify-between rounded-xl bg-background p-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <EyeOff className="h-4 w-4 text-muted-foreground" /> Anonymous mode
            </span>
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="h-6 w-11 cursor-pointer appearance-none rounded-full bg-muted transition-all checked:bg-primary relative before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:shadow before:transition-all checked:before:left-[1.375rem]"
            />
          </label>
          {anonymous && (
            <p className="mb-3 px-1 text-xs text-muted-foreground">Your identity will not be attached to this message — even managers and directors cannot see who sent it.</p>
          )}

          <textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message…"
            className="min-h-[200px] w-full resize-none rounded-2xl bg-background p-4 text-base outline-none"
          />
        </div>
      )}
    </div>
  );
}

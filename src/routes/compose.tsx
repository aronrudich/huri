import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, Users, User as UserIcon, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getMessageRecipients } from "@/lib/directory.functions";
import { sendMessagePush } from "@/lib/push.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/compose")({
  head: () => ({ meta: [{ title: "Compose · Huri" }] }),
  component: ComposePage,
});

type Person = { id: string; name: string };
type Group = { id: string; name: string };

function ComposePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [q, setQ] = useState("");
  const [selectedPeople, setSelectedPeople] = useState<Person[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getMessageRecipients(),
      supabase.from("roles").select("id, name").in("name", ["Valet", "Advisor", "Technician"]).order("name"),
    ]).then(([p, r]) => {
      setPeople(p.map((x) => ({
        id: x.id,
        name: `${x.nickname || x.fullName}${x.roleName ? ` (${x.roleName})` : ""}`,
      })));
      if (r.data) setGroups(r.data.map((x: any) => ({ id: x.id, name: `${x.name}s` })));
    }).catch((error) => {
      console.error("[compose] people query failed", error);
      toast.error("Could not load people. Try signing out and back in.");
    });
  }, [user]);

  const selectedIds = useMemo(() => new Set(selectedPeople.map((p) => p.id)), [selectedPeople]);

  const filteredPeople = useMemo(() => {
    const base = people.filter((p) => !selectedIds.has(p.id));
    if (!q.trim()) return base;
    const n = q.toLowerCase();
    return base.filter((p) => p.name.toLowerCase().includes(n));
  }, [people, q, selectedIds]);
  const filteredGroups = useMemo(() => {
    if (selectedPeople.length > 0) return [];
    if (!q.trim()) return groups;
    const n = q.toLowerCase();
    return groups.filter((g) => g.name.toLowerCase().includes(n));
  }, [groups, q, selectedPeople.length]);

  const addPerson = (p: Person) => {
    setSelectedGroup(null);
    setSelectedPeople((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p]));
    setQ("");
    setShowPicker(false);
  };
  const removePerson = (id: string) => setSelectedPeople((prev) => prev.filter((p) => p.id !== id));
  const pickGroup = (g: Group) => {
    setSelectedPeople([]);
    setSelectedGroup(g);
    setQ("");
    setShowPicker(false);
  };

  const canSend = !!user && !!body.trim() && (selectedGroup !== null || selectedPeople.length > 0);

  const send = async () => {
    if (!canSend || !user) return;
    setBusy(true);
    let thread_id: string;
    const payload: any = { body: body.trim(), sender_id: user.id };

    if (selectedGroup) {
      thread_id = `group:${selectedGroup.id}:${user.id}`;
      payload.recipient_role_id = selectedGroup.id;
    } else if (selectedPeople.length === 1) {
      const other = selectedPeople[0];
      const ids = [user.id, other.id].sort();
      thread_id = `dm:${ids[0]}:${ids[1]}`;
      payload.recipient_id = other.id;
    } else {
      const ids = Array.from(new Set([user.id, ...selectedPeople.map((p) => p.id)])).sort();
      thread_id = `gm:${ids.join("_")}`;
    }
    payload.thread_id = thread_id;

    const { error } = await supabase.from("messages").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    sendMessagePush({
      data: {
        threadId: thread_id,
        body: body.trim(),
        recipientId: payload.recipient_id ?? null,
        recipientRoleId: payload.recipient_role_id ?? null,
        isAnonymous: false,
      },
    }).catch((e) => console.warn("msg push failed", e));
    toast.success("Sent");
    navigate({ to: "/thread/$threadId", params: { threadId: thread_id }, replace: true });
  };

  const hasSelection = selectedGroup !== null || selectedPeople.length > 0;

  return (
    <div className="min-h-screen bg-surface safe-top safe-bottom">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Link to="/" className="grid h-8 w-8 place-items-center rounded-full text-primary"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="flex-1 text-center text-base font-semibold">New Message</h1>
        <button
          disabled={!canSend || busy}
          onClick={send}
          className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >Send</button>
      </header>

      <div className="px-4 pt-3">
        {/* Recipient chip area */}
        <div className="mb-3 rounded-2xl bg-background p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">To</p>
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              aria-label="Add recipient"
              className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary hover:bg-primary/20"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {!hasSelection && (
            <p className="text-sm text-muted-foreground">Tap + to add people or a group.</p>
          )}

          {selectedGroup && (
            <div className="flex items-center gap-2 rounded-xl bg-accent/60 px-3 py-2">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-accent text-accent-foreground">
                <Users className="h-4 w-4" />
              </div>
              <span className="flex-1 text-sm font-medium">{selectedGroup.name} (group)</span>
              <button
                type="button"
                onClick={() => setSelectedGroup(null)}
                aria-label="Remove"
                className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {selectedPeople.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {selectedPeople.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-xl bg-primary/5 px-3 py-2">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <span className="flex-1 text-sm font-medium">{p.name}</span>
                  <button
                    type="button"
                    onClick={() => removePerson(p.id)}
                    aria-label={`Remove ${p.name}`}
                    className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message…"
          className="min-h-[200px] w-full resize-none rounded-2xl bg-background p-4 text-base outline-none"
        />
      </div>

      {showPicker && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowPicker(false)}
        >
          <div
            className="flex w-full max-w-sm flex-col rounded-2xl bg-background shadow-xl"
            style={{ maxHeight: "80vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-base font-semibold">Add recipient</h2>
              <button
                onClick={() => setShowPicker(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-border px-4 py-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search people or groups"
                  className="w-full rounded-xl bg-muted py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredGroups.length > 0 && (
                <>
                  <h3 className="px-5 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Groups</h3>
                  <ul>
                    {filteredGroups.map((g) => (
                      <li key={g.id}>
                        <button
                          onClick={() => pickGroup(g)}
                          className="flex w-full items-center gap-3 border-b border-border px-5 py-3 last:border-b-0 active:bg-accent"
                        >
                          <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground">
                            <Users className="h-4 w-4" />
                          </div>
                          <span className="flex-1 text-left text-sm font-medium">{g.name}</span>
                          <span className="text-xs text-muted-foreground">Group</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <h3 className="px-5 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">People</h3>
              <ul>
                {filteredPeople.length === 0 && (
                  <li className="px-5 py-6 text-center text-sm text-muted-foreground">No matches</li>
                )}
                {filteredPeople.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => addPerson(p)}
                      className="flex w-full items-center gap-3 border-b border-border px-5 py-3 last:border-b-0 active:bg-accent"
                    >
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
                        <UserIcon className="h-4 w-4" />
                      </div>
                      <span className="flex-1 text-left text-sm font-medium">{p.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

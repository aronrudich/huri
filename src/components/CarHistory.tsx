import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type EventRow = {
  id: string;
  event_type: string;
  detail: string | null;
  notes: string | null;
  actor_id: string | null;
  created_at: string;
};

const TITLES: Record<string, string> = {
  logged: "Added to Huri",
  moved: "Moved",
  note: "Note",
  deleted: "Deleted",
  staged: "Staged",
  unstaged: "Stage cleared",
  request: "Request submitted",
  claimed: "Claimed",
  canceled: "Canceled",
  completed: "Completed",
};

/**
 * Full paper trail for one car (by RO#): every log, move, note, request,
 * claim, cancellation and completion, newest first. Rendered at the very
 * bottom of the car's page.
 */
export function CarHistory({ ro }: { ro: string }) {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const clean = ro.trim();
    if (!clean) { setRows([]); return; }
    let alive = true;
    void (async () => {
      const { data } = await supabase
        .from("car_events")
        .select("id, event_type, detail, notes, actor_id, created_at")
        .eq("ro_number", clean)
        .order("created_at", { ascending: false })
        .limit(200);
      if (!alive) return;
      const list = (data as EventRow[]) ?? [];
      setRows(list);
      const ids = Array.from(new Set(list.map((r) => r.actor_id).filter(Boolean) as string[]));
      if (!ids.length) return;
      const { data: people } = await supabase.from("profiles").select("id, full_name, nickname, role_name").in("id", ids);
      if (!alive) return;
      const map: Record<string, string> = {};
      ((people as { id: string; full_name: string | null; nickname: string | null; role_name: string | null }[]) ?? []).forEach((p) => {
        map[p.id] = `${p.nickname || p.full_name || "Employee"}${p.role_name ? ` (${p.role_name})` : ""}`;
      });
      setNames(map);
    })();
    return () => { alive = false; };
  }, [ro]);

  const when = (iso: string) => format(new Date(iso), "MMM d, yyyy · h:mm a");

  return (
    <div className="rounded-xl bg-surface px-3 py-2 text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-1 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          History{rows.length ? ` (${rows.length})` : ""}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        rows.length === 0 ? (
          <p className="pb-1 text-xs text-muted-foreground">Nothing recorded for this car yet.</p>
        ) : (
          <ul className="space-y-2 pb-1">
            {rows.map((r) => (
              <li key={r.id} className="border-t border-border pt-2">
                <p className="text-sm font-semibold">{TITLES[r.event_type] ?? r.event_type}</p>
                {r.detail && <p className="text-xs text-muted-foreground">{r.detail}</p>}
                <p className="text-xs text-muted-foreground">
                  {r.actor_id ? (names[r.actor_id] ?? "Employee") : "Huri"} · {when(r.created_at)}
                </p>
                {r.notes && (
                  <p className="text-xs text-muted-foreground"><span className="font-medium">Note:</span> {r.notes}</p>
                )}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

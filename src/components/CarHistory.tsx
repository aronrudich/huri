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

type RequestRow = {
  id: string;
  kind: string | null;
  is_staged: boolean | null;
  status: string;
  source_role: string | null;
  advisor_name: string | null;
  car_notes: string | null;
  lot_position: string | null;
  requested_by: string | null;
  claimed_by: string | null;
  created_at: string;
  claimed_at: string | null;
  completed_at: string | null;
};

/** Only the events that aren't already part of a submission card. */
const CAR_TITLES: Record<string, string> = {
  logged: "Added to Huri",
  moved: "Moved",
  edited: "Details edited",
  deleted: "Deleted",
  staged: "Staged",
};

type Entry = {
  key: string;
  at: string;
  title: string;
  lines: string[];
};

const isTech = (role: string | null | undefined) =>
  role === "Technician" || role === "Shop Foreman";

function requestTitle(r: RequestRow) {
  if (r.is_staged) return "Stage request";
  switch (r.kind) {
    case "parts": return "Parts request";
    case "wash": return "Wash request";
    case "park": return "Park request";
    case "shuttle": return "Shuttle request";
    default: return isTech(r.source_role) ? "Technician pickup" : "Customer pickup";
  }
}

/**
 * Readable paper trail for one car (by RO#). Each submission is a single entry
 * covering who asked, who handled it and how it ended — plus the car's own
 * location changes. Newest first.
 */
export function CarHistory({ ro }: { ro: string }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const clean = ro.trim();
    if (!clean) { setEvents([]); setRequests([]); return; }
    let alive = true;
    void (async () => {
      const [eventRes, requestRes] = await Promise.all([
        supabase
          .from("car_events")
          .select("id, event_type, detail, notes, actor_id, created_at")
          .eq("ro_number", clean)
          .in("event_type", Object.keys(CAR_TITLES))
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("pickup_requests")
          .select("id, kind, is_staged, status, source_role, advisor_name, car_notes, lot_position, requested_by, claimed_by, created_at, claimed_at, completed_at")
          .eq("ro_number", clean)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (!alive) return;
      const eventList = (eventRes.data as EventRow[]) ?? [];
      const requestList = (requestRes.data as RequestRow[]) ?? [];
      setEvents(eventList);
      setRequests(requestList);

      const ids = Array.from(new Set([
        ...eventList.map((r) => r.actor_id),
        ...requestList.map((r) => r.requested_by),
        ...requestList.map((r) => r.claimed_by),
      ].filter(Boolean) as string[]));
      if (!ids.length) return;
      const { data: people } = await supabase
        .from("profiles").select("id, full_name, nickname, role_name").in("id", ids);
      if (!alive) return;
      const map: Record<string, string> = {};
      ((people as { id: string; full_name: string | null; nickname: string | null; role_name: string | null }[]) ?? [])
        .forEach((p) => {
          map[p.id] = `${p.nickname || p.full_name || "Employee"}${p.role_name ? ` (${p.role_name})` : ""}`;
        });
      setNames(map);
    })();
    return () => { alive = false; };
  }, [ro]);

  const when = (iso: string) => format(new Date(iso), "MMM d · h:mm a");
  const who = (id: string | null) => (id ? (names[id] ?? "Employee") : "Huri");

  const entries: Entry[] = [
    ...events.map((e) => ({
      key: `e-${e.id}`,
      at: e.created_at,
      title: CAR_TITLES[e.event_type] ?? e.event_type,
      lines: [
        e.detail,
        `${who(e.actor_id)} · ${when(e.created_at)}`,
        e.notes ? `Note: ${e.notes}` : null,
      ].filter(Boolean) as string[],
    })),
    ...requests.map((r) => {
      const canceled = r.status === "canceled" || r.status === "cancelled";
      const outcome = canceled
        ? `Canceled${r.completed_at ? ` · ${when(r.completed_at)}` : ""}`
        : r.claimed_by
          ? `Handled by ${who(r.claimed_by)}${r.claimed_at ? ` · ${when(r.claimed_at)}` : ""}`
          : r.status === "unclaimed" ? "Waiting — not claimed yet" : "Closed without a claim";
      return {
        key: `r-${r.id}`,
        at: r.created_at,
        title: requestTitle(r),
        lines: [
          `Asked by ${who(r.requested_by)} · ${when(r.created_at)}`,
          outcome,
          r.car_notes ? `Note: ${r.car_notes}` : null,
        ].filter(Boolean) as string[],
      };
    }),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div className="rounded-xl bg-surface px-3 py-2 text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-1 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          History{entries.length ? ` (${entries.length})` : ""}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        entries.length === 0 ? (
          <p className="pb-1 text-xs text-muted-foreground">Nothing recorded for this car yet.</p>
        ) : (
          <ul className="space-y-2 pb-1">
            {entries.map((entry) => (
              <li key={entry.key} className="border-t border-border pt-2">
                <p className="text-sm font-semibold">{entry.title}</p>
                {entry.lines.map((line, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{line}</p>
                ))}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

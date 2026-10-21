// Reports — claim volume and claim speed per employee.
// Days run 6:30 AM → 6:30 PM Pacific, so "Today" resets at 6:30 AM.
// Every claim counts toward totals and averages, however long it took.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { HuriLogo } from "@/components/BottomBar";
import { canViewReports } from "@/lib/roles";
import { getReport } from "@/lib/reports.functions";
import {
  RANGE_LABELS, formatDuration, formatDayKey, type RangeKey,
} from "@/lib/report-range";
import { ListSkeleton } from "@/components/ListSkeleton";
import { DateRangeCalendar } from "@/components/DateRangeCalendar";


export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports · Huri" },
      { name: "description", content: "Claim counts and average claim times per employee." },
      { property: "og:title", content: "Reports · Huri" },
      { property: "og:description", content: "Claim counts and average claim times per employee." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

const KIND_LABELS: Record<string, string> = {
  pickup_customer: "Customer pickups",
  pickup_tech: "Technician pickups",
  pickup: "Pickups",
  stage: "Stage requests",
  parts: "Parts",
  park: "Park requests",
  wash: "Wash",

};

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function hourLabel(h: number): string {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

function ReportsPage() {
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const [range, setRange] = useState<RangeKey>("day");
  const [view, setView] = useState<"claiming" | "submitting" | "points" | "custom">("claiming");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [openSubmitter, setOpenSubmitter] = useState<string | null>(null);
  const [openPoints, setOpenPoints] = useState<string | null>(null);
  const [custom, setCustom] = useState<{ start: string | null; end: string | null }>({
    start: null, end: null,
  });
  const [hoursOpen, setHoursOpen] = useState(false);
  const [hours, setHours] = useState<{ start: number | null; end: number | null }>({
    start: null, end: null,
  });
  const fetchReport = useServerFn(getReport);

  const allowed = canViewReports(profile?.role_name) || !!profile?.is_owner;
  const customReady = range !== "custom" || (!!custom.start && !!custom.end);
  const hoursReady = hours.start !== null && hours.end !== null && hours.start < hours.end;

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  const { data, isPending, error } = useQuery({
    queryKey: ["report", range, custom.start, custom.end, hours.start, hours.end],
    enabled: !!user && allowed && customReady,
    staleTime: 60_000,
    queryFn: () =>
      fetchReport({
        data: range === "custom"
          ? {
              range,
              start: custom.start!,
              end: custom.end!,
              ...(hoursReady ? { startHour: hours.start!, endHour: hours.end! } : {}),
            }
          : { range },
      }),
  });


  if (!loading && user && !allowed) {
    return (
      <div className="min-h-screen bg-surface px-4 pb-32 safe-top">
        <Header />
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Reports are only available to management and spectator accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface pb-32 safe-top">
      <div className="px-4">
        <Header />
      </div>

      <div className="sticky top-0 z-10 bg-surface/95 px-4 pb-3 pt-1 backdrop-blur">
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={`flex-1 rounded-lg px-1 py-2 text-[11px] font-semibold transition-colors md:text-sm ${
                range === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground active:bg-accent"
              }`}
            >
              {RANGE_LABELS[key]}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-1 rounded-xl bg-muted p-1">
          {([["claiming", "Claiming"], ["submitting", "Submitting"], ["points", "Points"], ["custom", "Custom"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`flex-1 rounded-lg px-1.5 py-2 text-[11px] font-semibold transition-colors md:text-sm ${
                view === key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground active:bg-accent"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>


      <div className="space-y-5 px-4">
        {range === "custom" && (
          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-sm font-semibold">
                {custom.start
                  ? custom.end
                    ? `${formatDayKey(custom.start)} – ${formatDayKey(custom.end)}`
                    : `${formatDayKey(custom.start)} – pick an end date`
                  : "Pick a start date"}
              </span>
              {(custom.start || custom.end) && (
                <button
                  type="button"
                  onClick={() => setCustom({ start: null, end: null })}
                  className="text-xs font-semibold text-primary active:opacity-60"
                >
                  Clear
                </button>
              )}
            </div>
            <DateRangeCalendar
              start={custom.start}
              end={custom.end}
              onChange={(start, end) => setCustom({ start, end })}
            />
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <button
                type="button"
                onClick={() => setHoursOpen((v) => !v)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left active:bg-accent"
              >
                <span className="flex-1 text-sm font-semibold">Custom hours</span>
                <span className="text-xs text-muted-foreground">
                  {hoursReady
                    ? `${hourLabel(hours.start!)} – ${hourLabel(hours.end!)}`
                    : "All hours"}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    hoursOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {hoursOpen && (
                <div className="space-y-2 border-t border-border px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <label className="w-10 text-xs font-semibold text-muted-foreground">From</label>
                    <select
                      value={hours.start ?? ""}
                      onChange={(e) =>
                        setHours((h) => ({
                          ...h,
                          start: e.target.value === "" ? null : Number(e.target.value),
                        }))
                      }
                      className="flex-1 rounded-lg border border-border bg-surface px-2 py-2 text-sm font-semibold"
                    >
                      <option value="">Any</option>
                      {HOURS.map((h) => (
                        <option key={h} value={h}>{hourLabel(h)}</option>
                      ))}
                    </select>
                    <label className="w-6 text-right text-xs font-semibold text-muted-foreground">To</label>
                    <select
                      value={hours.end ?? ""}
                      onChange={(e) =>
                        setHours((h) => ({
                          ...h,
                          end: e.target.value === "" ? null : Number(e.target.value),
                        }))
                      }
                      className="flex-1 rounded-lg border border-border bg-surface px-2 py-2 text-sm font-semibold"
                    >
                      <option value="">Any</option>
                      {HOURS.map((h) => (
                        <option key={h} value={h}>{hourLabel(h)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">
                      Only counts submissions started between these hours (Pacific).
                    </p>
                    {(hours.start !== null || hours.end !== null) && (
                      <button
                        type="button"
                        onClick={() => setHours({ start: null, end: null })}
                        className="text-xs font-semibold text-primary active:opacity-60"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {error && (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-destructive">
            {(error as Error).message}
          </p>
        )}

        {range === "custom" && !customReady ? null : isPending && !data ? (
          <ListSkeleton rows={5} />

        ) : data ? (
          <>
            {view === "custom" ? (
              <CustomView
                data={data}
                roles={selectedRoles}
                setRoles={setSelectedRoles}
                metrics={selectedMetrics}
                setMetrics={setSelectedMetrics}
              />
            ) : view === "points" ? (() => {
              const ranked = [...(data.employees ?? [])].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
              const active = ranked.filter((e) => e.points !== 0 || Object.keys(e.breakdown ?? {}).length > 0);
              const top = active[0];
              void top;
              return (
                <>
                  <section>
                    <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">Points</h2>
                    {active.length === 0 ? (
                      <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">No points in this window yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {active.map((e, i) => {
                          const open = openPoints === e.id;
                          const items = Object.entries(e.breakdown ?? {}).sort((a, b) => b[1].points - a[1].points);
                          return (
                          <li key={e.id} className="rounded-xl border border-border bg-card">
                            <button type="button" onClick={() => setOpenPoints(open ? null : e.id)} className="flex w-full items-center gap-3 p-3 text-left">
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{e.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{e.role || "—"} · {e.claims} claims</p>
                              </div>
                              <div className="text-right">
                                <p className={`text-base font-bold leading-tight ${e.points < 0 ? "text-destructive" : ""}`}>{e.points.toFixed(1)}</p>
                                <p className="text-[11px] leading-tight text-muted-foreground">points</p>
                              </div>
                            </button>
                            {open && (
                              <ul className="space-y-1 border-t border-border px-3 py-2 text-sm">
                                {items.map(([cat, v]) => (
                                  <li key={cat} className="flex items-center justify-between gap-2">
                                    <span className={v.points < 0 ? "text-destructive" : ""}>{cat} <span className="text-xs text-muted-foreground">({v.count})</span></span>
                                    <span className={`font-semibold ${v.points < 0 ? "text-destructive" : "text-primary"}`}>{v.points > 0 ? "+" : ""}{v.points.toFixed(1)}</span>
                                  </li>
                                ))}
                                <li className="flex items-center justify-between border-t border-border pt-1 font-bold">
                                  <span>Total</span><span>{e.points.toFixed(1)} pts</span>
                                </li>
                              </ul>
                            )}
                          </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                </>
              );
            })() : view === "claiming" ? (
              <>
            <section className="grid grid-cols-2 gap-3">
              <Stat label="Submissions" value={String(data.total)} />
              <Stat label="Claimed" value={String(data.claimed)} />
              <Stat label="Avg claim time" value={formatDuration(data.avgMs)} />
              <Stat label="Still unclaimed" value={String(data.unclaimed)} />
            </section>

            <section>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Employees
              </h2>
              {(data.employees ?? []).length === 0 ? (
                <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  No claims in this window yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {(data.employees ?? []).map((e, i) => (
                    <li key={e.id} className="rounded-xl border border-border bg-card p-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{e.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{e.role || "—"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-bold leading-tight">{e.claims}</p>
                          <p className="text-[11px] leading-tight text-muted-foreground">claims</p>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 border-t border-border pt-2 text-center">
                        <Mini label="Avg" value={formatDuration(e.avgMs)} />
                        <Mini label="Fastest" value={formatDuration(e.fastestMs)} />
                        <Mini label="Slowest" value={formatDuration(e.slowestMs)} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                By submission type
              </h2>
              {(data.kinds ?? []).length === 0 ? (
                <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  No submissions in this window.
                </p>
              ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                  {(data.kinds ?? []).map((k) => (
                    <li key={k.kind} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {KIND_LABELS[k.kind] ?? k.kind}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {k.claimed}/{k.total} claimed
                      </span>
                      <span className="w-16 text-right text-sm font-semibold">
                        {formatDuration(k.avgMs)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="pb-4 text-center text-[11px] leading-relaxed text-muted-foreground">
              Days start at 6:30 AM Pacific. Every claim counts toward totals and averages.
            </p>
              </>
            ) : (
              <>
                <section className="grid grid-cols-2 gap-3">
                  <Stat label="Submissions" value={String(data.submittedTotal ?? 0)} />
                  <Stat label="Employees submitting" value={String(data.submitterCount ?? 0)} />
                </section>

                <section>
                  <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    Submissions by employee
                  </h2>
                  {(data.submitters ?? []).length === 0 ? (
                    <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                      No submissions in this window yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {(data.submitters ?? []).map((s, i) => {
                        const open = openSubmitter === s.id;
                        return (
                          <li key={s.id} className="rounded-xl border border-border bg-card">
                            <button
                              type="button"
                              onClick={() => setOpenSubmitter(open ? null : s.id)}
                              className="flex w-full items-center gap-3 p-3 text-left active:bg-accent"
                            >
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {i + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{s.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{s.role || "—"}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-base font-bold leading-tight">{s.submissions}</p>
                                <p className="text-[11px] leading-tight text-muted-foreground">
                                  submitted
                                </p>
                              </div>
                            </button>
                            {open && (
                              <ul className="border-t border-border px-3 py-2">
                                {Object.entries(s.byKind ?? {})
                                  .sort((a, b) => b[1] - a[1])
                                  .map(([kind, count]) => (
                                    <li key={kind} className="flex items-center justify-between py-1">
                                      <span className="text-xs text-muted-foreground">
                                        {KIND_LABELS[kind] ?? kind}
                                      </span>
                                      <span className="text-xs font-semibold">{count}</span>
                                    </li>
                                  ))}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                <p className="pb-4 text-center text-[11px] leading-relaxed text-muted-foreground">
                  Days start at 6:30 AM Pacific. Counts include every submission type.
                </p>
              </>
            )}
          </>

        ) : null}
      </div>
    </div>
  );
}

function Header() {
  const navigate = useNavigate();
  return (
    <header className="flex items-center gap-2 pb-3 pt-3">
      <button
        type="button"
        aria-label="Back"
        onClick={() => navigate({ to: "/pickup" })}
        className="rounded-full p-1 active:bg-accent"
      >
        <ArrowLeft className="h-6 w-6" />
      </button>
      <HuriLogo />
      <div className="flex-1" />
      <span className="text-sm font-semibold text-muted-foreground">Reports</span>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-bold leading-tight">{value}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold leading-tight">{value}</p>
    </div>
  );
}

type ReportData = Awaited<ReturnType<typeof getReport>>;

const KIND_KEYS = ["pickup_customer", "pickup_tech", "stage", "park", "parts", "wash"] as const;
const KIND_SHORT: Record<string, string> = {
  pickup_customer: "Customer pickups", pickup_tech: "Tech pickups", stage: "Staging",
  park: "Park requests", parts: "Parts", wash: "Wash",
};

type Metric = { key: string; label: string; group: string };
const METRICS: Metric[] = [
  ...KIND_KEYS.map((k) => ({ key: `c:${k}`, label: KIND_SHORT[k], group: "Claims" })),
  { key: "c:all", label: "All claims", group: "Claims" },
  ...KIND_KEYS.map((k) => ({ key: `s:${k}`, label: KIND_SHORT[k], group: "Submissions" })),
  { key: "s:all", label: "All submissions", group: "Submissions" },
  { key: "b:Locations logged", label: "Locations logged", group: "Lot & accuracy" },
  { key: "b:Unlogged locations", label: "Unlogged locations", group: "Lot & accuracy" },
  { key: "b:Vehicle photos", label: "Vehicle photos", group: "Lot & accuracy" },
  { key: "p:total", label: "Total points", group: "Points" },
];
const GROUPS = ["Claims", "Submissions", "Lot & accuracy", "Points"];

function CustomView({
  data, roles, setRoles, metrics, setMetrics,
}: {
  data: ReportData;
  roles: string[]; setRoles: (r: string[]) => void;
  metrics: string[]; setMetrics: (m: string[]) => void;
}) {
  const subs = new Map((data.submitters ?? []).map((s) => [s.id, s]));
  const emps = new Map((data.employees ?? []).map((e) => [e.id, e]));
  const ids = [...new Set([...emps.keys(), ...subs.keys()])];
  const roster = ids.map((id) => {
    const e = emps.get(id); const s = subs.get(id);
    return { id, name: e?.name ?? s?.name ?? "Employee", role: e?.role || s?.role || "Employee", e, s };
  });
  const allRoles = [...new Set(roster.map((r) => r.role))].sort();

  const value = (r: (typeof roster)[number], key: string): number => {
    const [t, k] = [key.slice(0, 1), key.slice(2)];
    if (t === "c") {
      if (k === "all") return r.e?.claims ?? 0;
      const bk = r.e?.byKind ?? {};
      return k === "pickup_customer" ? (bk.pickup_customer ?? 0) + (bk.pickup ?? 0) : bk[k] ?? 0;
    }
    if (t === "s") {
      if (k === "all") return r.s?.submissions ?? 0;
      const bk = r.s?.byKind ?? {};
      return k === "pickup_customer" ? (bk.pickup_customer ?? 0) + (bk.pickup ?? 0) : bk[k] ?? 0;
    }
    if (t === "b") return r.e?.breakdown?.[k]?.count ?? 0;
    return Math.round((r.e?.points ?? 0) * 10) / 10;
  };

  const toggle = (list: string[], v: string) => list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  const pill = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
      on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground active:bg-accent"
    }`;

  const rows = roster
    .filter((r) => roles.length === 0 || roles.includes(r.role))
    .map((r) => ({ ...r, vals: metrics.map((m) => value(r, m)) }))
    .map((r) => ({ ...r, sum: r.vals.reduce((a, b) => a + b, 0) }))
    .filter((r) => r.vals.some((v) => v !== 0))
    .sort((a, b) => b.sum - a.sum || a.name.localeCompare(b.name));

  return (
    <>
      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Employees</h2>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={pill(roles.length === 0)} onClick={() => setRoles([])}>All</button>
          {allRoles.map((r) => (
            <button key={r} type="button" className={pill(roles.includes(r))} onClick={() => setRoles(toggle(roles, r))}>{r}</button>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Metrics</h2>
          <div className="flex gap-3">
            <button type="button" className="text-xs font-semibold text-primary active:opacity-60" onClick={() => setMetrics(METRICS.map((m) => m.key))}>Select all</button>
            {metrics.length > 0 && (
              <button type="button" className="text-xs font-semibold text-primary active:opacity-60" onClick={() => setMetrics([])}>Clear</button>
            )}
          </div>
        </div>
        {GROUPS.map((g) => (
          <div key={g}>
            <p className="mb-1 text-[11px] font-semibold text-muted-foreground">{g}</p>
            <div className="flex flex-wrap gap-1.5">
              {METRICS.filter((m) => m.group === g).map((m) => (
                <button key={m.key} type="button" className={pill(metrics.includes(m.key))} onClick={() => setMetrics(toggle(metrics, m.key))}>{m.label}</button>
              ))}
            </div>
          </div>
        ))}
      </section>
      <section>
        {metrics.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Select one or more metrics above to view employee performance.
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Nothing matches in this window.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.role}</p>
                  </div>
                  {metrics.length > 1 && (
                    <p className="text-base font-bold">{Number.isInteger(r.sum) ? r.sum : r.sum.toFixed(1)}</p>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border pt-2">
                  {metrics.map((m, j) => {
                    const meta = METRICS.find((x) => x.key === m)!;
                    const prefix = meta.group === "Claims" ? "Claimed " : meta.group === "Submissions" ? "Submitted " : "";
                    return (
                      <span key={m} className="rounded-md bg-muted px-2 py-1 text-[11px]">
                        <span className="text-muted-foreground">{prefix}{prefix ? meta.label.toLowerCase() : meta.label}:</span>{" "}
                        <span className="font-semibold">{r.vals[j]}</span>
                      </span>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

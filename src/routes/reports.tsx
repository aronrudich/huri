// Reports — claim volume and claim speed per employee.
// Days run 6:30 AM → 6:30 PM Pacific, so "Today" resets at 6:30 AM.
// Claims slower than 20 minutes are counted but never averaged (anomalies).
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
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
  pickup: "Pickups",
  stage: "Stage requests",
  parts: "Parts",
  park: "Park requests",
  wash: "Wash",
  shuttle: "Shuttle",
};

function ReportsPage() {
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const [range, setRange] = useState<RangeKey>("day");
  const [view, setView] = useState<"claiming" | "submitting">("claiming");
  const [openSubmitter, setOpenSubmitter] = useState<string | null>(null);
  const [custom, setCustom] = useState<{ start: string | null; end: string | null }>({
    start: null, end: null,
  });
  const fetchReport = useServerFn(getReport);

  const allowed = canViewReports(profile?.role_name) || !!profile?.is_owner;
  const customReady = range !== "custom" || (!!custom.start && !!custom.end);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  const { data, isPending, error } = useQuery({
    queryKey: ["report", range, custom.start, custom.end],
    enabled: !!user && allowed && customReady,
    staleTime: 60_000,
    queryFn: () =>
      fetchReport({
        data: range === "custom"
          ? { range, start: custom.start!, end: custom.end! }
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
          {([["claiming", "Claiming"], ["submitting", "Submitting"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors md:text-sm ${
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
            {view === "claiming" ? (
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
                        <Mini label="Over 20m" value={String(e.anomalies)} />
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
              Days start at 6:30 AM Pacific. Claims over 20 minutes still count toward totals
              but are left out of every average.
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

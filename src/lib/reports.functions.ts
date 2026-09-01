import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canViewReports } from "@/lib/roles";
import {
  shiftWindowStart, shiftDayStart, shiftDayEnd, isDayKey, type RangeKey,
} from "@/lib/report-range";


export type EmployeeStat = {
  id: string;
  name: string;
  role: string;
  claims: number;
  avgMs: number | null;
  fastestMs: number | null;
  anomalies: number;
  byKind: Record<string, number>;
};

export type SubmitterStat = {
  id: string;
  name: string;
  role: string;
  submissions: number;
  byKind: Record<string, number>;
};

export type KindStat = {
  kind: string;
  total: number;
  claimed: number;
  avgMs: number | null;
};

export type ReportData = {
  rangeStart: string | null;
  rangeEnd?: string | null;

  total: number;
  claimed: number;
  unclaimed: number;
  avgMs: number | null;
  anomalies: number;
  employees: EmployeeStat[];
  kinds: KindStat[];
  submitters: SubmitterStat[];
  submittedTotal: number;
  submitterCount: number;
};

/** Claims slower than this are anomalies: counted, but never averaged. */
const ANOMALY_MS = 20 * 60_000;

const kindOf = (row: { kind: string | null; is_staged: boolean | null }) =>
  row.is_staged ? "stage" : (row.kind || "pickup");

export const getReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { range: RangeKey; start?: string; end?: string }) => {
    const allowed: RangeKey[] = ["day", "week", "month", "all", "custom"];
    if (!allowed.includes(input?.range)) throw new Error("Invalid range");
    if (input.range === "custom") {
      if (!isDayKey(input.start) || !isDayKey(input.end)) throw new Error("Pick a start and end date");
      if (input.start > input.end) throw new Error("Start date must come before the end date");
      return { range: input.range, start: input.start, end: input.end };
    }
    return { range: input.range };
  })

  .handler(async ({ data, context }): Promise<ReportData> => {
    const { supabase, userId } = context;

    const { data: me } = await supabase
      .from("profiles")
      .select("role_name, is_owner, is_active, status")
      .eq("id", userId)
      .maybeSingle();
    const allowed =
      !!me && me.is_active === true && me.status === "approved" &&
      (me.is_owner === true || canViewReports(me.role_name));
    if (!allowed) throw new Error("Reports are not available for your role.");

    const custom = data.range === "custom" && data.start && data.end;
    const start = custom ? shiftDayStart(data.start!) : shiftWindowStart(data.range);
    const end = custom ? shiftDayEnd(data.end!) : null;

    let query = supabase
      .from("pickup_requests")
      .select("id, kind, is_staged, status, created_at, claimed_at, claimed_by, requested_by")
      .order("created_at", { ascending: false })
      .limit(20000);
    if (start) query = query.gte("created_at", start.toISOString());
    if (end) query = query.lt("created_at", end.toISOString());

    const { data: rows, error } = await query;
    if (error) throw error;

    const list = rows ?? [];
    const claimedRows = list.filter((r) => !!r.claimed_at && !!r.claimed_by);

    const durations = claimedRows.map((r) => ({
      row: r,
      ms: new Date(r.claimed_at as string).getTime() - new Date(r.created_at).getTime(),
    }));
    const clean = durations.filter((d) => d.ms >= 0 && d.ms <= ANOMALY_MS);

    const avg = (values: number[]) =>
      values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

    // ---- per employee -------------------------------------------------------
    const perEmployee = new Map<string, {
      claims: number; clean: number[]; anomalies: number; byKind: Record<string, number>;
    }>();
    durations.forEach(({ row, ms }) => {
      const id = row.claimed_by as string;
      const entry = perEmployee.get(id) ?? { claims: 0, clean: [], anomalies: 0, byKind: {} };
      entry.claims += 1;
      const k = kindOf(row);
      entry.byKind[k] = (entry.byKind[k] ?? 0) + 1;
      if (ms >= 0 && ms <= ANOMALY_MS) entry.clean.push(ms);
      else entry.anomalies += 1;
      perEmployee.set(id, entry);
    });

    const ids = [...perEmployee.keys()];
    const names = new Map<string, { name: string; role: string }>();
    if (ids.length) {
      const { data: people } = await supabase
        .from("profiles")
        .select("id, full_name, nickname, role_name")
        .in("id", ids);
      (people ?? []).forEach((p) => {
        names.set(p.id, { name: p.nickname || p.full_name || "Employee", role: p.role_name ?? "" });
      });
    }

    const employees: EmployeeStat[] = ids.map((id) => {
      const entry = perEmployee.get(id)!;
      const who = names.get(id);
      return {
        id,
        name: who?.name ?? "Former employee",
        role: who?.role ?? "",
        claims: entry.claims,
        avgMs: avg(entry.clean),
        fastestMs: entry.clean.length ? Math.min(...entry.clean) : null,
        anomalies: entry.anomalies,
        byKind: entry.byKind,
      };
    }).sort((a, b) => b.claims - a.claims || a.name.localeCompare(b.name));

    // ---- per submission type ------------------------------------------------
    const perKind = new Map<string, { total: number; claimed: number; clean: number[] }>();
    list.forEach((row) => {
      const k = kindOf(row);
      const entry = perKind.get(k) ?? { total: 0, claimed: 0, clean: [] };
      entry.total += 1;
      if (row.claimed_at && row.claimed_by) {
        entry.claimed += 1;
        const ms = new Date(row.claimed_at).getTime() - new Date(row.created_at).getTime();
        if (ms >= 0 && ms <= ANOMALY_MS) entry.clean.push(ms);
      }
      perKind.set(k, entry);
    });

    const kinds: KindStat[] = [...perKind.entries()]
      .map(([kind, v]) => ({ kind, total: v.total, claimed: v.claimed, avgMs: avg(v.clean) }))
      .sort((a, b) => b.total - a.total);

    return {
      rangeStart: start ? start.toISOString() : null,
      rangeEnd: end ? end.toISOString() : null,

      total: list.length,
      claimed: claimedRows.length,
      unclaimed: list.filter((r) => r.status === "unclaimed").length,
      avgMs: avg(clean.map((d) => d.ms)),
      anomalies: durations.length - clean.length,
      employees,
      kinds,
    };
  });

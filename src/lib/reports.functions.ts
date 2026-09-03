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
      .select("role_name, is_owner, is_active, status, dealership_id")
      .eq("id", userId)
      .maybeSingle();
    const allowed =
      !!me && me.is_active === true && me.status === "approved" &&
      (me.is_owner === true || canViewReports(me.role_name));
    if (!allowed) throw new Error("Reports are not available for your role.");

    const custom = data.range === "custom" && data.start && data.end;
    const start = custom ? shiftDayStart(data.start!) : shiftWindowStart(data.range);
    const end = custom ? shiftDayEnd(data.end!) : null;

    // The Data API caps any single read at 1000 rows, which silently truncated
    // "all time" history. Page through until a short batch comes back.
    const PAGE = 1000;
    const MAX_ROWS = 50_000;
    type Row = {
      id: string; kind: string | null; is_staged: boolean | null; status: string;
      created_at: string; claimed_at: string | null; claimed_by: string | null;
      requested_by: string | null;
    };
    const rows: Row[] = [];
    for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
      let query = supabase
        .from("pickup_requests")
        .select("id, kind, is_staged, status, created_at, claimed_at, claimed_by, requested_by")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + PAGE - 1);
      if (start) query = query.gte("created_at", start.toISOString());
      if (end) query = query.lt("created_at", end.toISOString());

      const { data: batch, error } = await query;
      if (error) throw error;
      rows.push(...((batch ?? []) as Row[]));
      if (!batch || batch.length < PAGE) break;
    }


    // Canceled requests never count toward any stat.
    const list = (rows ?? []).filter(
      (r) => r.status !== "canceled" && r.status !== "cancelled",
    );
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

    // ---- per submitter (who is using the app) --------------------------------
    const perSubmitter = new Map<string, { submissions: number; byKind: Record<string, number> }>();
    list.forEach((row) => {
      const id = row.requested_by as string | null;
      if (!id) return;
      const entry = perSubmitter.get(id) ?? { submissions: 0, byKind: {} };
      entry.submissions += 1;
      const k = kindOf(row);
      entry.byKind[k] = (entry.byKind[k] ?? 0) + 1;
      perSubmitter.set(id, entry);
    });

    const names = new Map<string, { name: string; role: string }>();

    // Every active, approved teammate — so employees with zero activity still
    // show up in both leaderboards.
    const roster = new Set<string>();
    for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
      const { data: everyone, error: rosterError } = await supabase
        .from("profiles")
        .select("id, full_name, nickname, role_name, is_active, status")
        .eq("dealership_id", me!.dealership_id)
        .eq("is_active", true)
        .eq("status", "approved")
        .order("id", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (rosterError) throw rosterError;
      (everyone ?? []).forEach((p) => {
        names.set(p.id, { name: p.nickname || p.full_name || "Employee", role: p.role_name ?? "" });
        roster.add(p.id);
      });
      if (!everyone || everyone.length < PAGE) break;
    }


    // Anyone with activity but not on the current roster (deactivated/left).
    const missing = [...new Set([...perEmployee.keys(), ...perSubmitter.keys()])]
      .filter((id) => !names.has(id));
    if (missing.length) {
      const { data: people } = await supabase
        .from("profiles")
        .select("id, full_name, nickname, role_name")
        .in("id", missing);
      (people ?? []).forEach((p) => {
        names.set(p.id, { name: p.nickname || p.full_name || "Employee", role: p.role_name ?? "" });
      });
    }

    const submitterIds = [...new Set([...roster, ...perSubmitter.keys()])];
    const claimerIds = [...new Set([...roster, ...perEmployee.keys()])];

    const submitters: SubmitterStat[] = submitterIds.map((id) => {
      const entry = perSubmitter.get(id);
      const who = names.get(id);
      return {
        id,
        name: who?.name ?? "Former employee",
        role: who?.role ?? "",
        submissions: entry?.submissions ?? 0,
        byKind: entry?.byKind ?? {},
      };
    }).sort((a, b) => b.submissions - a.submissions || a.name.localeCompare(b.name));

    const employees: EmployeeStat[] = claimerIds.map((id) => {
      const entry = perEmployee.get(id);
      const who = names.get(id);
      return {
        id,
        name: who?.name ?? "Former employee",
        role: who?.role ?? "",
        claims: entry?.claims ?? 0,
        avgMs: entry ? avg(entry.clean) : null,
        fastestMs: entry && entry.clean.length ? Math.min(...entry.clean) : null,
        anomalies: entry?.anomalies ?? 0,
        byKind: entry?.byKind ?? {},
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
      submitters,
      submittedTotal: submitters.reduce((sum, s) => sum + s.submissions, 0),
      submitterCount: submitters.filter((s) => s.submissions > 0).length,
    };
  });

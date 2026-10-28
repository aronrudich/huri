import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canViewReports } from "@/lib/roles";
import { normalizeSpot, adjacentSpots, lotOf } from "@/lib/lot";
import { bayCustodyDeductions, parkClaimDeduction, UNLOGGED_POINTS, type CustodyRow } from "@/lib/unlogged-custody";
import { isReportEligible } from "@/lib/report-eligibility";
import { loadAllCarPages } from "@/lib/car-loading";
import { blockersForLocation, type LocationRule } from "@/lib/company-locations";
import {
  shiftWindowStart, shiftDayStart, shiftDayEnd, isDayKey, pacificHour, type RangeKey,
} from "@/lib/report-range";


export type EmployeeStat = {
  id: string;
  name: string;
  role: string;
  claims: number;
  avgMs: number | null;
  fastestMs: number | null;
  slowestMs: number | null;
  anomalies: number;
  byKind: Record<string, number>;
  points: number;
  breakdown: Record<string, { points: number; count: number }>;
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
  totalPoints: number;
};


/** Pickups are split by who asked: technicians vs. customer-facing staff. */
const isTechSource = (role: string | null | undefined) =>
  role === "Technician" || role === "Shop Foreman";

const kindOf = (row: { kind: string | null; is_staged: boolean | null; source_role?: string | null }) => {
  if (row.is_staged) return "stage";
  const kind = row.kind || "pickup";
  if (kind !== "pickup") return kind;
  return isTechSource(row.source_role) ? "pickup_tech" : "pickup_customer";
};

export const getReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    range: RangeKey; start?: string; end?: string; startHour?: number; endHour?: number;
  }) => {
    const allowed: RangeKey[] = ["day", "week", "month", "all", "custom"];
    if (!allowed.includes(input?.range)) throw new Error("Invalid range");
    const hasHours = input.startHour !== undefined || input.endHour !== undefined;
    const hoursValid =
      Number.isInteger(input.startHour) && Number.isInteger(input.endHour) &&
      (input.startHour as number) >= 0 && (input.startHour as number) <= 23 &&
      (input.endHour as number) >= 0 && (input.endHour as number) <= 23 &&
      (input.startHour as number) < (input.endHour as number);
    if (input.range === "custom") {
      if (!isDayKey(input.start) || !isDayKey(input.end)) throw new Error("Pick a start and end date");
      if (input.start > input.end) throw new Error("Start date must come before the end date");
      if (hasHours) {
        if (!hoursValid) throw new Error("Pick a valid start and end hour");
        return {
          range: input.range, start: input.start, end: input.end,
          startHour: input.startHour, endHour: input.endHour,
        };
      }
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

    if (!me) throw new Error("No company for this account");
    const { data: company, error: companyError } = await supabase.from("dealerships")
      .select("timezone, shift_start_minutes, company_code").eq("id", me.dealership_id).single();
    if (companyError) throw companyError;
    const timeZone = company.timezone;
    const shiftMinutes = company.shift_start_minutes;
    const locationRules = await loadAllCarPages<LocationRule>((from,to)=>supabase.from("company_location_rules")
      .select("label, lot_name, capacity, blockers").eq("dealership_id",me.dealership_id).order("label").range(from,to));
    const isJcd = company.company_code === "JCD29854";
    const custom = data.range === "custom" && data.start && data.end;
    const start = custom && data.start ? shiftDayStart(data.start, timeZone, shiftMinutes) : shiftWindowStart(data.range, new Date(), timeZone, shiftMinutes);
    const end = custom && data.end ? shiftDayEnd(data.end, timeZone, shiftMinutes) : null;

    // The Data API caps any single read at 1000 rows, which silently truncated
    // "all time" history. Page through until a short batch comes back.
    const PAGE = 1000;
    type Row = {
      id: string; kind: string | null; is_staged: boolean | null; status: string;
      created_at: string; claimed_at: string | null; claimed_by: string | null;
      requested_by: string | null; source_role: string | null; completed_at: string | null;
      lot_position: string | null; ro_number: string | null; dealership_id: string;
    };
    const rows: Row[] = [];
    for (let offset = 0; ; offset += PAGE) {
      let query = supabase
        .from("pickup_requests")
        .select("id, kind, is_staged, status, created_at, claimed_at, claimed_by, requested_by, source_role, completed_at, lot_position, ro_number, dealership_id")
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


    // One eligibility gate precedes every count, timing, submission and point stat.
    // Claims strictly over eight hours stay in history but contribute nothing here.
    let list = rows.filter(isReportEligible);

    // Optional custom hour window: keep only submissions whose Pacific hour of
    // creation falls inside [startHour, endHour). Per-row math keeps DST correct.
    if (data.range === "custom" && data.startHour !== undefined && data.endHour !== undefined) {
      const from = data.startHour;
      const to = data.endHour;
      list = list.filter((r) => {
        const h = pacificHour(new Date(r.created_at), timeZone);
        return h >= from && h < to;
      });
    }
    const claimedRows = list.filter((r) => !!r.claimed_at && !!r.claimed_by);

    const durations = claimedRows.map((r) => ({
      row: r,
      ms: new Date(r.claimed_at as string).getTime() - new Date(r.created_at).getTime(),
    }));
    const clean = durations.filter((d) => d.ms >= 0);

    const avg = (values: number[]) =>
      values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

    // ---- valet points (weights stay server-side, never shown) ---------------
    type Ev = { dealership_id: string; ro_number: string | null; event_type: string; detail: string | null; actor_id: string | null; created_at: string };
    // Seed with each car's last known spot before the range, then replay only in-range moves.
    const seed: Ev[] = [];
    if (start) {
      const { data: snap, error: snapErr } = await (supabase.rpc as unknown as (
        fn: string, args: Record<string, unknown>,
      ) => Promise<{ data: Omit<Ev, "actor_id">[] | null; error: Error | null }>)(
        "lot_snapshot_at", { _at: start.toISOString() },
      );
      if (snapErr) throw snapErr;
      (snap ?? []).forEach((s) => seed.push({ ...s, actor_id: null }));
    }
    const events: Ev[] = [];
    for (let offset = 0; ; offset += PAGE) {
      let q = supabase
        .from("car_events")
        .select("dealership_id, ro_number, event_type, detail, actor_id, created_at")
        .in("event_type", ["logged", "moved", "deleted"])
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (start) q = q.gte("created_at", start.toISOString());
      if (end) q = q.lt("created_at", end.toISOString());
      const { data: batch, error } = await q;
      if (error) throw error;
      events.push(...((batch ?? []) as Ev[]));
      if (!batch || batch.length < PAGE) break;
    }
    const replay: Ev[] = [...seed, ...events];
    const destOf = (e: Ev): string | null => {
      if (e.event_type === "deleted") return null;
      const d = e.detail ?? "";
      let m = d.match(/Added to Huri at (.+)$/) || d.match(/→\s*(.+)$/) || d.match(/ to (.+)$/);
      return m ? normalizeSpot(m[1]) : null;
    };
    // Replay location history; at each claim, count occupied blocker spots.
    const claimsByTime = durations
      .map((d) => d.row)
      .filter((r) => kindOf(r) !== "parts" && kindOf(r) !== "park" && kindOf(r) !== "wash")
      .sort((a, b) => a.claimed_at!.localeCompare(b.claimed_at!));
    const blockersFor = new Map<string, number>();
    const carAt = new Map<string, string>(); // dealership|ro -> spot
    const spotCount = new Map<string, number>(); // dealership|spot -> cars
    const bump = (k: string, n: number) => spotCount.set(k, (spotCount.get(k) ?? 0) + n);
    let ei = 0;
    for (const r of claimsByTime) {
      while (ei < replay.length && replay[ei].created_at <= r.claimed_at!) {
        const e = replay[ei++];
        if (!e.ro_number) continue;
        const key = `${e.dealership_id}|${e.ro_number}`;
        const prev = carAt.get(key);
        if (prev) { bump(`${e.dealership_id}|${prev}`, -1); carAt.delete(key); }
        const next = destOf(e);
        if (next) { carAt.set(key, next); bump(`${e.dealership_id}|${next}`, 1); }
      }
      const spot = normalizeSpot(r.lot_position);
      if (spot) {
        blockersFor.set(r.id, blockersForLocation(spot,locationRules,isJcd).filter((s) => (spotCount.get(`${r.dealership_id}|${s}`) ?? 0) > 0).length);
      }
    }
    const pointsFor = (r: Row): number => {
      const k = kindOf(r);
      if (k === "parts") return 1.1;
      if (k === "park") return 0.7;
      if (k === "wash") return 0.7;
      const lot = lotOf(r.lot_position);
      if ((isJcd && lot === "sv") || locationRules.some((rule)=>rule.label===normalizeSpot(r.lot_position) && rule.blockers.length>0)) return [1.5, 1.8, 2.1][Math.min(2, blockersFor.get(r.id) ?? 0)];
      if (lot === "bl") return 1.2;
      if (lot === "cp") return k === "stage" ? 1.2 : 1.0;
      return 1.3;
    };
    const pointsByEmployee = new Map<string, number>();
    const breakdownBy = new Map<string, Record<string, { points: number; count: number }>>();
    const addPts = (id: string, n: number, cat: string) => {
      pointsByEmployee.set(id, (pointsByEmployee.get(id) ?? 0) + n);
      const b = breakdownBy.get(id) ?? {};
      const c = b[cat] ?? { points: 0, count: 0 };
      c.points += n; c.count += 1; b[cat] = c;
      breakdownBy.set(id, b);
    };
    const CAT: Record<string, string> = {
      pickup_customer: "Customer deliveries", pickup_tech: "Technician deliveries",
      stage: "Staging", park: "Park requests", parts: "Parts runs", wash: "Wash",
    };
    durations.forEach(({ row }) => addPts(row.claimed_by as string, pointsFor(row), CAT[kindOf(row)] ?? "Other requests"));
    const inHours = (iso: string) =>
      !(data.range === "custom" && data.startHour !== undefined && data.endHour !== undefined) ||
      (pacificHour(new Date(iso), timeZone) >= data.startHour && data.endHour !== undefined && pacificHour(new Date(iso), timeZone) < data.endHour);
    // Technicians earn +0.3 for every request they submit (car, parts, park, wash).
    list.forEach((r) => {
      if (!r.requested_by || !isTechSource(r.source_role)) return;
      if (r.status === "canceled" || r.status === "cancelled") return;
      if (!inHours(r.created_at)) return;
      addPts(r.requested_by, 0.3, "Requests submitted");
    });
    // Manual add/edit of car locations (automatic moves carry no actor).
    // Latest completed staging request per car: a CP check-in within 30 minutes
    // of completion is that same staging work, already credited at +1.2.
    const stageDoneAt = new Map<string, number>();
    list.forEach((r) => {
      if (kindOf(r) !== "stage" || r.status !== "completed" || !r.ro_number) return;
      const at = r.completed_at ?? r.claimed_at;
      if (!at) return;
      const key = `${r.dealership_id}|${r.ro_number}`;
      stageDoneAt.set(key, Math.max(stageDoneAt.get(key) ?? 0, new Date(at).getTime()));
    });
    events.forEach((e) => {
      if (e.event_type === "deleted" || !e.actor_id) return;
      if (start && e.created_at < start.toISOString()) return;
      if (!inHours(e.created_at)) return;
      const dest = destOf(e);
      if (!dest || dest === "UNKNOWN") return; // not a real location — never earns points
      // Automated work destinations are already credited elsewhere — no bonus.
      if (dest === "BAY" || dest.startsWith("BAY ") || dest === "TAKEN" || dest === "WASH") return;
      if (dest === "CP") {
        const doneAt = stageDoneAt.get(`${e.dealership_id}|${e.ro_number}`);
        if (doneAt && e.created_at <= new Date(doneAt + 30 * 60_000).toISOString()) return;
      }
      addPts(e.actor_id, 0.3, "Locations logged");
    });
    // ---- unlogged locations (-1 each; automatic Huri moves never count) -----
    const UNLOGGED = "Unlogged locations";
    const live = rows.filter(isReportEligible);
    // Custody lookback: a car can enter a tech's bay days before someone finds it
    // unlogged. Load up to 30 days of earlier requests/events for in-range cars.
    const priorRows: Row[] = [];
    const priorEvents: Ev[] = [];
    if (start) {
      const ros = [...new Set(live.map((r) => r.ro_number).filter((x): x is string => !!x))];
      const lookFrom = new Date(start.getTime() - 30 * 86_400_000).toISOString();
      for (let i = 0; i < ros.length; i += 200) {
        const chunk = ros.slice(i, i + 200);
        for (let offset = 0; ; offset += PAGE) {
          const { data: batch, error } = await supabase
            .from("pickup_requests")
            .select("id, kind, is_staged, status, created_at, claimed_at, claimed_by, requested_by, source_role, completed_at, lot_position, ro_number, dealership_id")
            .in("ro_number", chunk)
            .gte("created_at", lookFrom)
            .lt("created_at", start.toISOString())
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(offset, offset + PAGE - 1);
          if (error) throw error;
          priorRows.push(...((batch ?? []) as Row[]).filter(isReportEligible));
          if (!batch || batch.length < PAGE) break;
        }
        for (let offset = 0; ; offset += PAGE) {
          const { data: batch, error } = await supabase
            .from("car_events")
            .select("dealership_id, ro_number, event_type, detail, actor_id, created_at")
            .in("ro_number", chunk)
            .in("event_type", ["logged", "moved"])
            .not("actor_id", "is", null)
            .gte("created_at", lookFrom)
            .lt("created_at", start.toISOString())
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(offset, offset + PAGE - 1);
          if (error) throw error;
          priorEvents.push(...((batch ?? []) as Ev[]));
          if (!batch || batch.length < PAGE) break;
        }
      }
    }
    const custodyEvents: Ev[] = [...priorEvents, ...events];
    // Parts runs and the "picked up" shortcut say nothing about where a car is.
    const byRo = new Map<string, Row[]>();
    [...priorRows, ...live].forEach((r) => {
      if (!r.ro_number || r.status === "picked_up" || kindOf(r) === "parts") return;
      const k = `${r.dealership_id}|${r.ro_number}`;
      (byRo.get(k) ?? byRo.set(k, []).get(k)!).push(r);
    });
    byRo.forEach((list) => list.sort((a, b) => a.created_at.localeCompare(b.created_at)));
    // a) Park request claimed but no real spot logged from claim until 30 min
    //    after it left the list. Anchored at claim, never only at the late archive time.
    const movesFor = (dealer: string, ro: string, evs: Ev[]) =>
      evs.filter((e) => e.actor_id && e.event_type !== "deleted" && e.dealership_id === dealer && e.ro_number === ro)
        .map((e) => ({ actor_id: e.actor_id, created_at: e.created_at, dest: destOf(e) }));
    const asCustody = (r: Row) => ({ ...r, kind: kindOf(r) }) as unknown as CustodyRow;
    live.forEach((r) => {
      if (kindOf(r) !== "park" || !r.ro_number || !r.claimed_at || !inHours(r.claimed_at)) return;
      const who = parkClaimDeduction(asCustody(r), movesFor(r.dealership_id, r.ro_number, events));
      if (who) addPts(who, UNLOGGED_POINTS, UNLOGGED);
    });
    // b) Tech-bay custody, judged once per bay stay; see unlogged-custody.ts.
    byRo.forEach((list) => {
      const first = list[0];
      if (!first?.ro_number) return;
      const moves = movesFor(first.dealership_id, first.ro_number, custodyEvents);
      bayCustodyDeductions(list.map(asCustody), moves).forEach(({ tech, ender }) => {
        // Dated when someone else finds the car unlogged, not when it entered the bay.
        if (start && ender.created_at < start.toISOString()) return;
        if (end && ender.created_at >= end.toISOString()) return;
        if (!inHours(ender.created_at)) return;
        addPts(tech, UNLOGGED_POINTS, UNLOGGED);
      });
    });
    // Moves to UNKNOWN are never penalized: historically most were automatic
    // customer-pickup archives and spot-displacement bumps, not employee choices.

    // Photos uploaded onto a car earn a small bonus.
    {
      const photos = await loadAllCarPages<{ uploaded_by: string | null; created_at: string }>((from, to) => {
      let q = supabase
        .from("car_photos")
        .select("uploaded_by, created_at")
        .not("uploaded_by", "is", null);
      if (start) q = q.gte("created_at", start.toISOString());
      if (end) q = q.lt("created_at", end.toISOString());
      return q.order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to);
      });
      photos.forEach((p) => {
        if (!p.uploaded_by || !inHours(p.created_at)) return;
        addPts(p.uploaded_by, 0.2, "Vehicle photos");
      });
    }

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
      if (ms >= 0) entry.clean.push(ms);
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
    for (let offset = 0; ; offset += PAGE) {
      const { data: everyone, error: rosterError } = await supabase
        .from("profiles")
        .select("id, full_name, nickname, role_name, is_active, status")
        .eq("dealership_id", me.dealership_id)
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
      .concat([...pointsByEmployee.keys()])
      .filter((id, i, a) => !names.has(id) && a.indexOf(id) === i);
    if (missing.length) {
      for (let offset = 0; offset < missing.length; offset += 100) {
      const people = await loadAllCarPages((from, to) => supabase
        .from("profiles")
        .select("id, full_name, nickname, role_name")
        .eq("dealership_id", me.dealership_id)
        .in("id", missing.slice(offset, offset + 100))
        .order("id", { ascending: true }).range(from, to));
      people.forEach((p) => {
        names.set(p.id, { name: p.nickname || p.full_name || "Employee", role: p.role_name ?? "" });
      });
      }
    }

    const submitterIds = [...new Set([...roster, ...perSubmitter.keys()])];
    const claimerIds = [...new Set([...roster, ...perEmployee.keys(), ...pointsByEmployee.keys()])];

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
        slowestMs: entry && entry.clean.length ? Math.max(...entry.clean) : null,
        anomalies: entry?.anomalies ?? 0,
        byKind: entry?.byKind ?? {},
        points: Math.round((pointsByEmployee.get(id) ?? 0) * 10) / 10,
        breakdown: breakdownBy.get(id) ?? {},
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
        if (ms >= 0) entry.clean.push(ms);
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
      totalPoints: Math.round([...pointsByEmployee.values()].reduce((a, b) => a + b, 0) * 10) / 10,
    };
  });

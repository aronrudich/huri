// Huri "shift day" math. A reporting day runs 6:30 AM → 6:30 PM Pacific,
// so every window starts on a 6:30 AM Pacific boundary and the "1 day"
// numbers reset at 6:30 AM each morning.

export type RangeKey = "day" | "week" | "month" | "all" | "custom";

export const RANGE_LABELS: Record<RangeKey, string> = {
  day: "Today",
  week: "7 Days",
  month: "30 Days",
  all: "All Time",
  custom: "Custom",
};


const TZ = "America/Los_Angeles";
const SHIFT_START_HOUR = 6;
const SHIFT_START_MIN = 30;

/** Minutes that Pacific time is offset from UTC at a given instant (e.g. -420). */
function offsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(at);
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-08:00";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return -480;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/** Pacific wall-clock date parts for an instant. */
function laParts(at: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const map: Record<string, string> = {};
  fmt.formatToParts(at).forEach((p) => { map[p.type] = p.value; });
  return {
    year: Number(map['year']), month: Number(map['month']), day: Number(map['day']),
    hour: Number(map['hour'] === "24" ? "0" : map['hour']), minute: Number(map['minute']),
  };
}

/** Convert a Pacific wall-clock time to the matching UTC instant. */
function laWallToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  let guess = new Date(naive - offsetMinutes(new Date(naive)) * 60_000);
  guess = new Date(naive - offsetMinutes(guess) * 60_000);
  return guess;
}

/** Start of the current shift day (today's 6:30 AM Pacific, or yesterday's before then). */
export function currentShiftStart(now = new Date()): Date {
  const p = laParts(now);
  const beforeShift =
    p.hour < SHIFT_START_HOUR || (p.hour === SHIFT_START_HOUR && p.minute < SHIFT_START_MIN);
  const base = laWallToUtc(p.year, p.month, p.day, SHIFT_START_HOUR, SHIFT_START_MIN);
  return beforeShift ? new Date(base.getTime() - 24 * 3600_000) : base;
}

/** Window start for a range key; null means "all time" (or a custom range). */
export function shiftWindowStart(range: RangeKey, now = new Date()): Date | null {
  if (range === "all" || range === "custom") return null;
  const today = currentShiftStart(now);
  const daysBack = range === "day" ? 0 : range === "week" ? 6 : 29;

  if (daysBack === 0) return today;
  // Step back whole days from the Pacific wall clock so DST shifts stay on 6:30.
  const p = laParts(new Date(today.getTime() + 12 * 3600_000));
  const stepped = new Date(Date.UTC(p.year, p.month - 1, p.day - daysBack));
  return laWallToUtc(
    stepped.getUTCFullYear(), stepped.getUTCMonth() + 1, stepped.getUTCDate(),
    SHIFT_START_HOUR, SHIFT_START_MIN,
  );
}

/** "4m 12s" / "38s" / "1h 04m" */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

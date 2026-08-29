// Lightweight month-grid range picker (no extra dependency).
// Days are plain Pacific calendar keys ("YYYY-MM-DD"); shift-day math lives in report-range.ts.
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pacificToday } from "@/lib/report-range";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const key = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function DateRangeCalendar({
  start,
  end,
  onChange,
}: {
  start: string | null;
  end: string | null;
  onChange: (start: string | null, end: string | null) => void;
}) {
  const today = pacificToday();
  const [ty, tm] = [Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1];
  const [view, setView] = useState({ year: ty, month: tm });

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(view.year, view.month, 1));
    const lead = first.getUTCDay();
    const days = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
    const out: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d++) out.push(key(view.year, view.month, d));
    return out;
  }, [view]);

  const atLastMonth = view.year === ty && view.month === tm;

  const pick = (day: string) => {
    if (!start || (start && end)) onChange(day, null);
    else if (day < start) onChange(day, start);
    else onChange(start, day);
  };

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(Date.UTC(view.year, view.month, 1)));

  const shift = (delta: number) => {
    const next = new Date(Date.UTC(view.year, view.month + delta, 1));
    setView({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between pb-2">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => shift(-1)}
          className="rounded-full p-1.5 active:bg-accent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold">{monthLabel}</span>
        <button
          type="button"
          aria-label="Next month"
          disabled={atLastMonth}
          onClick={() => shift(1)}
          className="rounded-full p-1.5 active:bg-accent disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 pb-1">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="text-center text-[10px] font-semibold uppercase text-muted-foreground">
            {w}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <span key={`e${i}`} />;
          const future = day > today;
          const isStart = day === start;
          const isEnd = day === end;
          const inRange = !!start && !!end && day > start && day < end;
          const selected = isStart || isEnd;
          return (
            <button
              key={day}
              type="button"
              disabled={future}
              onClick={() => pick(day)}
              className={`h-9 rounded-lg text-xs font-semibold transition-colors disabled:opacity-25 ${
                selected
                  ? "bg-primary text-primary-foreground"
                  : inRange
                    ? "bg-primary/15 text-foreground"
                    : "text-foreground active:bg-accent"
              }`}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

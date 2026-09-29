import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Check, LoaderCircle } from "lucide-react";
import huriLogo from "@/assets/huri-logo-compressed.png.asset.json";
import { getArrivalInfo, submitArrival } from "@/lib/arrive.functions";

/**
 * Customer-facing arrival screen. No sign-in, no navigation, no app chrome:
 * the customer taps the link their advisor texted them, scrolls to the time
 * they'll show up. The car shows on the valets' pickup list and opens for claiming 20 minutes before that time.
 */
export const Route = createFileRoute("/arrive/$slug")({
  // A numeric ?ro=190246 arrives as a number, so accept either and keep the
  // link exactly as the advisor sent it.
  validateSearch: z.object({ ro: z.union([z.string(), z.number()]).optional() }),
  loaderDeps: ({ search }) => ({ ro: search.ro === undefined ? undefined : String(search.ro) }),
  loader: async ({ params, deps }) => {
    try {
      return await getArrivalInfo({ data: { slug: params.slug, ro: deps.ro } });
    } catch {
      return null;
    }
  },
  head: () => ({
    meta: [
      { title: "Vehicle Ready for Pickup" },
      { name: "description", content: "Tap to confirm your arrival time and we'll have your vehicle pulled up and waiting." },
      { property: "og:title", content: "Vehicle Ready for Pickup" },
      { property: "og:description", content: "Tap to confirm your arrival time and we'll have your vehicle pulled up and waiting." },
      { name: "twitter:title", content: "Vehicle Ready for Pickup" },
      { name: "twitter:description", content: "Tap to confirm your arrival time and we'll have your vehicle pulled up and waiting." },
      { property: "og:image", content: "https://huri.team/icon-512.png" },
      { name: "twitter:image", content: "https://huri.team/icon-512.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ArrivePage,
});

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const MERIDIEMS = ["AM", "PM"] as const;
const ITEM_HEIGHT = 44;

/** One column of the time drum. */
function Wheel<T extends string | number>({
  values, value, onChange, label, format,
}: {
  values: readonly T[];
  value: T;
  onChange: (next: T) => void;
  label: string;
  format?: (value: T) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touching = useRef(false);
  const moving = useRef(false);
  const index = values.indexOf(value);

  // Park the wheel on the selected row, but never while a finger or glide is moving it.
  useEffect(() => {
    const el = ref.current;
    if (!el || touching.current || moving.current) return;
    const target = Math.max(0, values.indexOf(value)) * ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - target) > 2) el.scrollTop = target;
  }, [value, values]);

  const commit = () => {
    const el = ref.current;
    if (!el || touching.current) return;
    moving.current = false;
    const next = values[Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_HEIGHT)))];
    if (next !== undefined && next !== value) onChange(next);
  };

  // Only save once the wheel has fully stopped.
  const onScroll = () => {
    moving.current = true;
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(commit, 160);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const end = () => { if (settle.current) clearTimeout(settle.current); commit(); };
    el.addEventListener("scrollend", end);
    return () => el.removeEventListener("scrollend", end);
  });

  const tapTo = (i: number) => {
    ref.current?.scrollTo({ top: i * ITEM_HEIGHT, behavior: "smooth" });
  };

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      onTouchStart={() => { touching.current = true; }}
      onTouchEnd={() => { touching.current = false; onScroll(); }}
      onTouchCancel={() => { touching.current = false; onScroll(); }}
      role="listbox"
      aria-label={label}
      className="h-[132px] flex-1 touch-pan-y snap-y snap-mandatory overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
    >
      <div style={{ paddingTop: ITEM_HEIGHT, paddingBottom: ITEM_HEIGHT }}>
        {values.map((item, i) => (
          <button
            key={String(item)}
            type="button"
            role="option"
            aria-selected={i === index}
            onClick={() => tapTo(i)}
            className={`flex h-11 w-full snap-center items-center justify-center text-2xl tabular-nums transition-colors ${
              i === index ? "font-semibold text-foreground" : "text-muted-foreground/50"
            }`}
          >
            {format ? format(item) : item}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Adds days to a YYYY-MM-DD key. */
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Wall-clock parts of a moment on the company's clock. */
function partsIn(timeZone: string, at: Date) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit", hour12: true,
  }).formatToParts(at);
  const g = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return {
    date: `${g("year")}-${g("month")}-${g("day")}`,
    hour: Number(g("hour")) || 12,
    minute: Number(g("minute")),
    meridiem: (g("dayPeriod").toUpperCase().startsWith("P") ? "PM" : "AM") as "AM" | "PM",
  };
}

const dayLabel = (day: string, today: string) =>
  day === today
    ? "Today"
    : day === addDays(today, 1)
      ? "Tomorrow"
      : new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })
          .format(new Date(`${day}T12:00:00Z`));

function ArrivePage() {
  const info = Route.useLoaderData();
  const search = Route.useSearch();
  const ro = search.ro === undefined ? undefined : String(search.ro);
  const { slug } = Route.useParams();

  // Default to about 20 minutes from now, or whatever the customer picked before.
  const initial = useMemo(() => {
    const base = info?.currentEta ? new Date(info.currentEta) : new Date(Date.now() + 20 * 60_000);
    return partsIn(info?.timezone ?? "America/Los_Angeles", base);
  }, [info?.currentEta, info?.timezone]);
  const today = info?.today ?? initial.date;
  const tomorrow = addDays(today, 1);
  const [date, setDate] = useState(initial.date < today ? today : initial.date);

  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [meridiem, setMeridiem] = useState<"AM" | "PM">(initial.meridiem);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await submitArrival({ data: { slug, ro, date, hour, minute, meridiem } });
      setDone(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg.includes("passed") || msg.includes("later day") ? msg : "We couldn't save your arrival time. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!info) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 text-center">
        <img src={huriLogo.url} alt="Huri" className="h-14 w-auto" />
        <h1 className="mt-8 text-xl font-semibold">This link is no longer active</h1>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          Please contact your service advisor and they'll take care of you.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-surface px-6 pb-16 pt-14 safe-top safe-bottom">
      <img src={huriLogo.url} alt="Huri" className="h-14 w-auto" />

      {done ? (
        <div className="mt-14 w-full max-w-sm rounded-3xl bg-background p-8 text-center shadow-xl">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/10">
            <Check className="h-8 w-8 text-primary" />
          </div>
          <p className="mt-6 text-2xl font-semibold tracking-tight">
            Arriving {dayLabel(date, today)} at {hour}:{String(minute).padStart(2, "0")} {meridiem}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Fantastic! Feel free to update your ETA through the same link if anything changes.
            Thank you and see you soon!
          </p>
          <button
            type="button"
            onClick={() => setDone(false)}
            className="mt-7 w-full rounded-2xl bg-muted py-3.5 text-sm font-semibold text-foreground"
          >
            Change my time
          </button>
        </div>
      ) : (
        <div className="mt-12 w-full max-w-sm rounded-3xl bg-background p-7 shadow-xl">
          <p className="text-center text-sm font-medium text-muted-foreground">{info.companyName}</p>
          <h1 className="mt-3 text-center text-2xl font-semibold leading-snug tracking-tight">
            Your vehicle is ready
          </h1>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            What time will you be arriving to pick it up?
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Arrival day">
            {[
              { key: "today", label: "Today", on: date === today, pick: () => setDate(today) },
              { key: "tomorrow", label: "Tomorrow", on: date === tomorrow, pick: () => setDate(tomorrow) },
            ].map((o) => (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={o.on}
                onClick={o.pick}
                className={`rounded-xl py-2.5 text-sm font-semibold ${o.on ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
              >
                {o.label}
              </button>
            ))}
            <label
              className={`relative flex items-center justify-center rounded-xl py-2.5 text-sm font-semibold ${
                date !== today && date !== tomorrow ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              {date !== today && date !== tomorrow
                ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))
                : "Pick a date"}
              <input
                type="date"
                aria-label="Pick a date"
                min={today}
                value={date}
                onChange={(e) => e.target.value && e.target.value >= today && setDate(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
          </div>
          {date !== today && (
            <p className="mt-3 text-center text-sm font-medium text-muted-foreground">{dayLabel(date, today)}</p>
          )}

          <div className="relative mt-5">
            <div className="pointer-events-none absolute inset-x-0 top-1/2 h-11 -translate-y-1/2 rounded-xl bg-muted/60" />
            <div className="relative flex items-stretch gap-1">
              <Wheel values={HOURS} value={hour} onChange={setHour} label="Hour" />
              <Wheel
                values={MINUTES}
                value={minute}
                onChange={setMinute}
                label="Minute"
                format={(m) => String(m).padStart(2, "0")}
              />
              <Wheel values={MERIDIEMS} value={meridiem} onChange={setMeridiem} label="AM or PM" />
            </div>
          </div>

          {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {info.currentEta ? "Update Arrival Time" : "Confirm Arrival Time"}
          </button>
        </div>
      )}
    </div>
  );
}

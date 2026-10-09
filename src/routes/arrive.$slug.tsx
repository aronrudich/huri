import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Check, LoaderCircle } from "lucide-react";
import huriLogo from "@/assets/huri-logo-new.png.asset.json";
import { getArrivalInfo, markCustomerArrived, submitArrival } from "@/lib/arrive.functions";

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

/** One column of the time drum, with its own finger-follow, momentum and snap. */
function Wheel<T extends string | number>({
  values, value, onChange, label, format,
}: {
  values: readonly T[];
  value: T;
  onChange: (next: T) => void;
  label: string;
  format?: (value: T) => string;
}) {
  const max = (values.length - 1) * ITEM_HEIGHT;
  const [offset, setOffset] = useState(() => Math.max(0, values.indexOf(value)) * ITEM_HEIGHT);
  const pos = useRef(offset);
  const raf = useRef<number | null>(null);
  const drag = useRef<{ y: number; start: number; moved: boolean; samples: { t: number; y: number }[] } | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const set = (p: number) => { pos.current = p; setOffset(p); };
  const stop = () => { if (raf.current) cancelAnimationFrame(raf.current); raf.current = null; };
  const busy = () => drag.current !== null || raf.current !== null;

  // Follow outside changes only while the wheel is at rest.
  useEffect(() => {
    if (busy()) return;
    const target = Math.max(0, values.indexOf(value)) * ITEM_HEIGHT;
    if (Math.abs(pos.current - target) > 1) set(target);
  }, [value, values]);

  useEffect(() => stop, []);

  const commit = () => {
    const next = values[Math.round(pos.current / ITEM_HEIGHT)];
    if (next !== undefined && next !== valueRef.current) onChangeRef.current(next);
  };

  const snapTo = (target: number) => {
    stop();
    const from = pos.current;
    const t0 = performance.now();
    const dur = Math.min(420, 180 + Math.abs(target - from) * 1.2);
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      set(from + (target - from) * e);
      if (k < 1) raf.current = requestAnimationFrame(step);
      else { raf.current = null; commit(); }
    };
    raf.current = requestAnimationFrame(step);
  };

  const nearest = (p: number) => Math.min(max, Math.max(0, Math.round(p / ITEM_HEIGHT) * ITEM_HEIGHT));

  const glide = (velocity: number) => {
    stop();
    let v = velocity; // px per ms
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      let p = pos.current + v * dt;
      v *= Math.pow(0.955, dt / 16.67);
      if (p < 0 || p > max) { p = Math.min(max, Math.max(0, p)); v = 0; }
      set(p);
      if (Math.abs(v) > 0.05) raf.current = requestAnimationFrame(step);
      else { raf.current = null; snapTo(nearest(p)); }
    };
    raf.current = requestAnimationFrame(step);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    stop();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, start: pos.current, moved: false, samples: [{ t: performance.now(), y: e.clientY }] };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > 4) d.moved = true;
    let p = d.start - dy;
    if (p < 0) p = p / 3;
    if (p > max) p = max + (p - max) / 3;
    set(p);
    const now = performance.now();
    d.samples.push({ t: now, y: e.clientY });
    while (d.samples.length > 2 && now - d.samples[0].t > 100) d.samples.shift();
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      // Tap: glide the tapped row into the middle.
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const rowsFromCenter = Math.round((e.clientY - rect.top - rect.height / 2) / ITEM_HEIGHT);
      snapTo(nearest(pos.current + rowsFromCenter * ITEM_HEIGHT));
      return;
    }
    const first = d.samples[0];
    const lastS = d.samples[d.samples.length - 1];
    const dt = lastS.t - first.t;
    const v = dt > 0 && performance.now() - lastS.t < 80 ? -(lastS.y - first.y) / dt : 0;
    if (pos.current < 0 || pos.current > max || Math.abs(v) < 0.2) snapTo(nearest(pos.current));
    else glide(Math.max(-4, Math.min(4, v)));
  };

  const center = offset / ITEM_HEIGHT;

  return (
    <div
      role="listbox"
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="relative h-[132px] flex-1 cursor-grab touch-none select-none overflow-hidden"
    >
      <div style={{ transform: `translate3d(0, ${ITEM_HEIGHT - offset}px, 0)`, willChange: "transform" }}>
        {values.map((item, i) => {
          const dist = Math.abs(i - center);
          const selected = Math.round(center) === i;
          return (
            <div
              key={String(item)}
              role="option"
              aria-selected={selected}
              style={{ opacity: Math.max(0.25, 1 - dist * 0.45) }}
              className={`flex h-11 w-full items-center justify-center text-2xl tabular-nums ${
                selected ? "font-semibold text-foreground" : "text-muted-foreground"
              }`}
            >
              {format ? format(item) : item}
            </div>
          );
        })}
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
  const [alreadyHere, setAlreadyHere] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitArrivalFn = useServerFn(submitArrival);
  const markCustomerArrivedFn = useServerFn(markCustomerArrived);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await submitArrivalFn({ data: { slug, ro, date, hour, minute, meridiem } });
      setAlreadyHere(false);
      setDone(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg.includes("passed") || msg.includes("later day") ? msg : "We couldn't save your arrival time. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const arriveNow = async () => {
    setBusy(true);
    setError(null);
    try {
      await markCustomerArrivedFn({ data: { slug, ro } });
      setAlreadyHere(true);
      setDone(true);
    } catch {
      setError("We couldn't notify the team that you're here. Please try again or contact your advisor.");
    } finally {
      setBusy(false);
    }
  };

  if (!info) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 text-center overscroll-none select-none">
        <img src={huriLogo.url} alt="Huri" className="h-10 w-auto" />
        <h1 className="mt-8 text-xl font-semibold">This link is no longer active</h1>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          Please contact your service advisor and they'll take care of you.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-surface px-6 pb-16 pt-14 safe-top safe-bottom overscroll-none select-none">
      <img src={huriLogo.url} alt="Huri" className="h-10 w-auto" />

      {done ? (
        <div className="mt-14 w-full max-w-sm rounded-3xl bg-background p-8 text-center shadow-xl">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/10">
            <Check className="h-8 w-8 text-primary" />
          </div>
          <p className="mt-6 text-2xl font-semibold tracking-tight">
            {alreadyHere ? "You're checked in" : `Arriving ${dayLabel(date, today)} at ${hour}:${String(minute).padStart(2, "0")} ${meridiem}`}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {alreadyHere
              ? "We've notified the team that you're here. They'll bring your vehicle up as soon as possible."
              : "Fantastic! Feel free to update your ETA through the same link if anything changes. Thank you and see you soon!"}
          </p>
          {!alreadyHere && (
            <button
              type="button"
              onClick={() => setDone(false)}
              className="mt-7 w-full rounded-2xl bg-muted py-3.5 text-sm font-semibold text-foreground"
            >
              Change my time
            </button>
          )}
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
          <button
            type="button"
            onClick={arriveNow}
            disabled={busy || !ro}
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-muted py-2.5 text-sm font-semibold text-foreground disabled:opacity-50"
          >
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
            I'm already here
          </button>
        </div>
      )}
      <footer className="mt-8 pb-4 text-center text-xs text-muted-foreground">
        <span>Powered by Huri</span>
        <span className="mx-2">·</span>
        <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy</Link>
        <span className="mx-2">·</span>
        <Link to="/terms" className="underline underline-offset-2 hover:text-foreground">Terms</Link>
      </footer>
    </div>
  );
}

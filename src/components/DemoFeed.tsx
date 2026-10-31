import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import huriLogo from "@/assets/huri-logo-new.png.asset.json";

/**
 * Public homepage demo: fully simulated, client-side only.
 * The simulation performs no database reads, live subscriptions or network calls.
 * Normal page and asset delivery still has hosting costs.
 */
type Kind = "Customer" | "ETA" | "Tech" | "Parts" | "Park" | "Wash" | "Stage";
type Req = { id: number; kind: Kind; ro: string; car: string; spot: string; note?: string; blockers?: string[]; at: number; eta?: number; by?: string };

const KINDS: Kind[] = ["Customer", "ETA", "Tech", "Park", "Customer", "Parts", "Tech", "Wash", "ETA", "Tech", "Stage"];
const CARS = ["Toyota RAV4", "Toyota Camry", "Toyota Tacoma", "Lexus RX 350", "Lexus ES 350", "BMW X5", "BMW 330i", "Chevy Silverado", "Chevy Tahoe", "Nissan Rogue", "Nissan Altima", "Hyundai Tucson", "Honda CR-V", "Ford F-150", "Jeep Grand Cherokee", "Ram 1500"];
const VALETS = ["Marcus", "Leo", "Alex", "Seth", "Jordan"];
const CUSTOMER_NOTES = ["The mother with 3 kids", "tall guy in blue shirt", "man in the yellow vest"];
const TECH_NOTES = ["Car needs a jump", "I'm leaving. Will work on it tomorrow"];
const TECHS = ["Frank", "Mike", "Hector", "Leo", "Chris"];
const LIMITS: Record<string, number> = { "Lot A": 150, "Lot B": 80, "Lot C": 35 };
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
let nextId = 1;
let nextRo = 194210;
const ro = () => String(nextRo++);

function lotSpot() {
  const r = Math.random();
  if (r < 0.12) return { spot: "Side Lot" };
  if (r < 0.24) return { spot: "Front Lot" };
  const lot = pick(Object.keys(LIMITS));
  const n = 1 + Math.floor(Math.random() * LIMITS[lot]);
  return { spot: `${lot} - ${n}`, lot, n };
}
function blockersFor(lot: string, n: number, count = 1) {
  return Array.from({ length: Math.min(count, n - 1) }, (_, i) => `Blocked by: #${ro()} (${pick(CARS)} · ${lot} - ${n - 1 - i})`);
}
function makeReq(at: number, kind: Kind): Req {
  const base = { id: nextId++, kind, ro: ro(), car: pick(CARS), at };
  if (kind === "Park" || kind === "Parts") return { ...base, spot: `${pick(TECHS)}'s Bay` };
  const loc = lotSpot();
  return { ...base, ...loc,
    blockers: loc.lot && loc.n && loc.n > 1 && Math.random() < 0.2 ? blockersFor(loc.lot, loc.n) : undefined,
    eta: kind === "ETA" ? at + (12 + Math.floor(Math.random() * 13)) * 60000 : undefined,
    note: Math.random() < 0.18 ? kind === "Customer" ? pick(CUSTOMER_NOTES) : kind === "Tech" ? pick(TECH_NOTES) : undefined : undefined,
  };
}
const LABEL: Record<Kind, string> = { Customer: "Customer Pickup", ETA: "Customer Pickup - ETA", Tech: "Technician Pickup", Parts: "Parts", Park: "Park", Wash: "Wash", Stage: "Stage" };
const TONE: Record<Kind, string> = {
  Customer: "bg-primary text-primary-foreground", ETA: "bg-primary text-primary-foreground",
  Tech: "bg-destructive text-destructive-foreground", Parts: "bg-demo-parts text-demo-parts-foreground",
  Park: "bg-success text-success-foreground", Wash: "bg-demo-wash text-demo-wash-foreground", Stage: "bg-demo-stage text-demo-stage-foreground",
};
const upcomingEta = (at: number): Req => ({ ...makeReq(at, "ETA"), eta: at });
function seed() {
  const now = Date.now();
  const claimed = Array.from({ length: 14 }, (_, i) => ({ ...makeReq(now, KINDS[(i + 1) % KINDS.length]), by: pick(VALETS) }));
  for (const [i, lot, n, count] of [[1, "Lot A", 132, 2], [5, "Lot B", 47, 1], [9, "Lot C", 28, 1]] as const) {
    claimed[i] = { ...claimed[i], spot: `${lot} - ${n}`, blockers: blockersFor(lot, n, count) };
  }
  return { claimed, upcoming: [45, 52, 58].map(m => upcomingEta(now + m * 60000)), open: makeReq(now, KINDS[0]) as Req | null, nextKind: 1 };
}
function addNext(s: ReturnType<typeof seed>, now: number) {
  return { ...s, open: makeReq(now, KINDS[s.nextKind]), nextKind: (s.nextKind + 1) % KINDS.length,
    upcoming: s.upcoming.map(r => (r.eta ?? now) - now <= 30 * 60000 ? upcomingEta(now + 45 * 60000) : r) };
}

export function DemoFeed() {
  const [state, setState] = useState<ReturnType<typeof seed> | null>(null);
  const [now, setNow] = useState(0);
  const [pulse, setPulse] = useState(false);
  const timers = useRef(new Set<number>());

  useEffect(() => {
    setState(seed());
    setNow(Date.now());
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => { timers.current.delete(id); fn(); }, ms);
      timers.current.add(id);
    };
    const cycle = () => later(() => {
      setPulse(true);
      later(() => {
        setPulse(false);
        setState((s) => s?.open ? { ...s, open: null, claimed: [{ ...s.open, by: pick(VALETS) }, ...s.claimed].slice(0, 15) } : s);
        later(() => {
          setState((s) => s ? addNext(s, Date.now()) : s);
          cycle();
        }, 1500);
      }, 500);
    }, 2500 + Math.random() * 1000);
    cycle();
    return () => { clearInterval(tick); timers.current.forEach(clearTimeout); timers.current.clear(); };
  }, []);

  if (!state) return <div className="app-scroll bg-surface" />;
  return (
    <div className="app-scroll bg-surface overscroll-y-contain">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
          <img src={huriLogo.url} alt="Huri" className="h-7 w-auto" />
          <nav className="flex items-center gap-1.5">
            <Link to="/auth" search={{ mode: "business" }} className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted">Business</Link>
            <Link to="/auth" search={{ mode: "register" }} className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted">Register</Link>
            <Link to="/auth" search={{ mode: "login" }} className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted">Sign In</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-4">
        <Section title="Ready to Claim" count={state.open ? 1 : 0}>
          {state.open ? (
            <Card req={state.open} now={now} className={`transition-all duration-500 animate-in fade-in slide-in-from-top-2 `}>
              <span role="presentation" className={`inline-block cursor-default select-none rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground ${pulse ? "demo-claim-flash" : ""}`}>Claim</span>
            </Card>
          ) : (
            <div className="rounded-2xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">Drive clear · 0 cars waiting</div>
          )}
        </Section>

        <Section title="Claimed" count={state.claimed.length}>
          {state.claimed.map((r) => (
            <Card key={r.id} req={r} now={now} className="animate-in fade-in">
              <div className="text-right"><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">Claimed</span><p className="mt-1 text-xs text-muted-foreground">Claimed by <b className="text-foreground">{r.by}</b></p></div>
            </Card>
          ))}
        </Section>

        <Section title="Upcoming Arrivals" count={state.upcoming.length}>
          {state.upcoming.map((r) => (
            <Card key={r.id} req={r} now={now} upcoming className="opacity-40">
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">ETA in {Math.ceil(((r.eta ?? now) - now) / 60000)}m</span>
            </Card>
          ))}
        </Section>
      </main>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}<span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{count}</span></h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Card({ req, now, upcoming, className = "", children }: { req: Req; now: number; upcoming?: boolean; className?: string; children: React.ReactNode }) {
  const label = upcoming ? "Customer ETA" : LABEL[req.kind];
  const tone = TONE[req.kind];
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border bg-background px-4 py-3 ${className}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{label}</span>
          <span className="text-sm font-semibold">RO #{req.ro}</span>
        </div>
        <p className="mt-1 text-sm">{req.car} · <span className="font-medium">{req.spot}</span></p>
        {req.blockers?.map((b) => <p key={b} className="mt-0.5 text-xs font-medium text-destructive">{b}</p>)}
        {req.note && <p className="text-xs text-muted-foreground">{req.note}</p>}
        {req.eta && !upcoming && <p className="mt-1 text-xs font-medium text-primary">ETA in {Math.max(1, Math.ceil((req.eta - now) / 60000))}m</p>}
      </div>
      <div className="w-24 shrink-0 sm:w-28">{children}</div>
    </div>
  );
}

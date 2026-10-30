import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import huriLogo from "@/assets/huri-logo-new.png.asset.json";

/**
 * Public homepage demo: fully simulated, client-side only.
 * No database reads, realtime channels or network calls — zero running cost.
 */
type Kind = "Customer" | "ETA" | "Tech" | "Parts" | "Park" | "Wash";
type Req = { id: number; kind: Kind; ro: string; car: string; spot: string; note?: string; dest?: string; blockers?: string[]; at: number; eta?: number; by?: string; claimedAt?: number };

const KINDS: Kind[] = ["Customer", "Customer", "Customer", "Customer", "Customer", "ETA", "ETA", "ETA", "Tech", "Tech", "Tech", "Parts", "Park", "Wash"];
const CARS = ["Toyota RAV4", "Toyota Camry", "Toyota Tacoma", "Toyota Highlander", "Lexus RX 350", "Lexus ES 350", "BMW X5", "BMW 330i", "Chevy Silverado 1500", "Chevy Tahoe", "Chevy Equinox", "Nissan Rogue", "Nissan Altima", "Hyundai Tucson", "Honda CR-V", "Ford F-150", "Ford Explorer", "Jeep Grand Cherokee", "Ram 1500"];
const VALETS = ["Alex", "Marcus", "David", "Jordan"];
const ADVISORS = ["Service Drive - Sarah", "Service Drive - Mike", "Delivery Bay - Mike", "Service Drive - Priya", "Delivery Bay - Carlos"];
const CUSTOMER_NOTES = ["Tall guy in blue shirt", "Woman with 3 kids", "Guy with yellow vest", "Guy with dog", "Bring me key first"];
const TECH_NOTES = ["Car won't start. Needs push", "Might need a jumpstart"];
const TECHS = ["Leo", "Ruben", "Chris", "Dana"];
const BAYS = [4, 7, 9, 11, 12, 18];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
let nextId = 1;
let nextRo = 194210;
const ro = () => String((nextRo += 3 + Math.floor(Math.random() * 20)));

function lotSpot(allowUnnumbered = true) {
  const r = Math.random();
  if (allowUnnumbered && r < 0.1) return { spot: "Side Lot" };
  if (allowUnnumbered && r < 0.18) return { spot: "Front Lot" };
  const lot = pick(["Lot A", "Lot B", "Lot C"]);
  const n = 3 + Math.floor(Math.random() * 148);
  return { spot: `${lot} - ${n}`, lot, n };
}
// Tandem rows: only the neighbouring lower-numbered spot(s) in the same lot can block.
function blockersFor(lot: string, n: number, count = Math.random() < 0.3 ? 2 : 1) {
  return Array.from({ length: count }, (_, i) => `Blocked by RO #${193100 + Math.floor(Math.random() * 1100)} in ${lot} - ${n - 1 - i}`);
}

function makeReq(at: number, forced?: Kind): Req {
  const kind = forced ?? pick(KINDS);
  const base = { id: nextId++, kind, ro: ro(), car: pick(CARS), at };
  const bay = () => `Bay ${pick(BAYS)}`;
  if (kind === "Park") return { ...base, spot: bay(), dest: "Next open lot spot" };
  if (kind === "Parts") return { ...base, spot: "Parts Counter", dest: `${bay()} · Tech ${pick(TECHS)}` };
  const loc = lotSpot();
  const blockers = loc.lot && Math.random() < 0.22 ? blockersFor(loc.lot, loc.n!) : undefined;
  if (kind === "Tech") return { ...base, ...loc, blockers, dest: `${bay()} · Tech ${pick(TECHS)}`, note: Math.random() < 0.2 ? pick(TECH_NOTES) : undefined };
  if (kind === "Wash") return { ...base, ...loc, blockers, dest: "Wash Bay" };
  return { ...base, ...loc, blockers, dest: pick(ADVISORS), eta: kind === "ETA" ? at + 30 * 60000 : undefined, note: kind === "Customer" && Math.random() < 0.35 ? pick(CUSTOMER_NOTES) : undefined };
}

const LABEL: Record<Kind, string> = { Customer: "Customer is here", ETA: "Customer arriving in 30 minutes", Tech: "Technician pickup", Parts: "Parts", Park: "Park request", Wash: "🧼 Wash" };
// Same semantic tokens the real Pickup list uses.
const TONE: Record<Kind, string> = {
  Customer: "bg-primary text-primary-foreground",
  ETA: "bg-arrival text-arrival-foreground",
  Tech: "bg-destructive text-destructive-foreground",
  Parts: "bg-warning text-warning-foreground",
  Park: "bg-success text-success-foreground",
  Wash: "bg-wash text-wash-foreground",
};
const ago = (ms: number) => { const m = Math.floor(ms / 60000); return m < 1 ? "Just now" : `${m}m ago`; };
const upcomingEta = (at: number): Req => ({ ...makeReq(at, "ETA"), eta: at, at });

function seed() {
  const now = Date.now();
  const claimed: Req[] = [];
  for (let i = 0; i < 14; i++) {
    const at = now - (i * 4 + 1) * 60000 - Math.random() * 90000;
    claimed.push({ ...makeReq(at), by: pick(VALETS), claimedAt: at + 20000 + Math.random() * 40000 });
  }
  // Guarantee a few blocked cars and both note types are visible on load.
  const plant = (i: number, kind: Kind, n: number, lot: string, count: number, note?: string) => {
    claimed[i] = { ...claimed[i], kind, spot: `${lot} - ${n}`, blockers: blockersFor(lot, n, count), note, dest: kind === "Tech" ? `Bay ${pick(BAYS)} · Tech ${pick(TECHS)}` : pick(ADVISORS), eta: undefined };
  };
  plant(1, "Customer", 132, "Lot A", 2, "Woman with 3 kids");
  plant(5, "Tech", 47, "Lot B", 1, "Car won't start. Needs push");
  plant(9, "Customer", 88, "Lot C", 1, "Tall guy in blue shirt");
  claimed[3] = { ...claimed[3], kind: "Tech", note: "Might need a jumpstart" };
  const upcoming = [34, 41, 49, 58].map((m) => upcomingEta(now + m * 60000));
  return { claimed, upcoming, open: makeReq(now, "Customer") as Req | null };
}

export function DemoFeed() {
  const [state, setState] = useState(seed);
  const [now, setNow] = useState(Date.now());
  const [pulse, setPulse] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
    const cycle = () => later(() => {
      setPulse(true);
      later(() => {
        setPulse(false);
        setState((s) => s.open ? { ...s, open: null, claimed: [{ ...s.open, by: pick(VALETS), claimedAt: Date.now() }, ...s.claimed].slice(0, 15) } : s);
        later(() => {
          setState((s) => {
            const n = Date.now();
            // An ETA only becomes claimable once the customer is 30 minutes out.
            const due = s.upcoming[0] && s.upcoming[0].at - n <= 30 * 60000;
            if (due) return { ...s, upcoming: [...s.upcoming.slice(1), upcomingEta(n + (40 + Math.random() * 20) * 60000)], open: { ...s.upcoming[0], at: n } };
            return { ...s, open: makeReq(n) };
          });
          cycle();
        }, 1500);
      }, 500);
    }, 3000 + Math.random() * 1000);
    cycle();
    return () => { clearInterval(tick); timers.current.forEach(clearTimeout); };
  }, []);

  return (
    <div className="app-scroll bg-surface">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
          <img src={huriLogo.url} alt="Huri" className="h-7 w-auto" />
          <nav className="flex items-center gap-1.5">
            <Link to="/auth" search={{ mode: "business" }} className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted">Business</Link>
            <Link to="/auth" search={{ mode: "register" }} className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted">Register</Link>
            <Link to="/auth" search={{ mode: "login" }} className="rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">Sign In</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-4">
        <Section title="Ready to Claim" count={state.open ? 1 : 0}>
          {state.open ? (
            <Card req={state.open} now={now} className={`transition-all duration-500 animate-in fade-in slide-in-from-top-2 ${pulse ? "ring-2 ring-success scale-[0.99]" : ""}`}>
              <span role="presentation" className="inline-block cursor-default select-none rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">Claim</span>
            </Card>
          ) : (
            <div className="rounded-2xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">Drive clear · 0 cars waiting</div>
          )}
        </Section>

        <Section title="Claimed" count={state.claimed.length}>
          {state.claimed.map((r) => (
            <Card key={r.id} req={r} now={now} className="animate-in fade-in">
              <span className="text-right text-xs text-muted-foreground">Claimed by <b className="text-foreground">{r.by}</b><br />{ago(now - (r.claimedAt ?? now))}</span>
            </Card>
          ))}
        </Section>

        <Section title="Upcoming Arrivals" count={state.upcoming.length}>
          {state.upcoming.map((r) => (
            <Card key={r.id} req={r} now={now} upcoming className="opacity-40">
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">Arriving in {Math.max(1, Math.ceil((r.at - now) / 60000))}m</span>
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
  const tone = upcoming ? "bg-arrival/15 text-arrival" : TONE[req.kind];
  return (
    <div className={`flex items-center justify-between gap-3 rounded-2xl border bg-background px-4 py-3 ${className}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{label}</span>
          <span className="text-sm font-semibold">RO #{req.ro}</span>
        </div>
        <p className="mt-1 text-sm">{req.car} · <span className="font-medium">{req.spot}</span>{req.dest && <> → <span className="font-medium">{req.dest}</span></>}</p>
        {req.blockers?.map((b) => <p key={b} className="mt-0.5 text-xs font-medium text-destructive">{b}</p>)}
        {req.note && <p className="text-xs text-muted-foreground">{req.note}</p>}
        {req.at <= now && !req.by && <p className="text-[11px] text-muted-foreground">{ago(now - req.at)}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

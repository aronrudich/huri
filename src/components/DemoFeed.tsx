import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import huriLogo from "@/assets/huri-logo-new.png.asset.json";

/**
 * Public homepage demo: fully simulated, client-side only.
 * No database reads, realtime channels or network calls — zero running cost.
 */
type Kind = "Customer" | "ETA" | "Tech" | "Parts" | "Park" | "Wash";
type Req = { id: number; kind: Kind; ro: string; car: string; spot: string; note?: string; dest?: string; blockers?: string[]; at: number; by?: string; claimedAt?: number };

const KINDS: Kind[] = ["Customer", "Customer", "Customer", "Customer", "ETA", "ETA", "ETA", "Tech", "Tech", "Tech", "Parts", "Park", "Wash"];
const CARS = ["Grand Cherokee", "Ram 1500", "Wrangler", "Durango", "Charger", "Compass", "Pacifica", "Gladiator", "Ram 2500", "Cherokee", "Hornet", "Wagoneer"];
const VALETS = ["Marcus", "Alex", "Tyler", "Diego", "Jordan", "Luis", "Sam"];
const NOTES = ["Customer waiting in lounge", "Keys on advisor desk", "Customer with kids", "Recalls completed", "Ready for test drive", "Alignment rack"];
const TECHS = ["Dave", "Leo", "Ruben", "Chris"];
const TECH_BAYS = ["Bay 4", "Bay 7", "Bay 12", "Bay 9"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
let nextId = 1;
let nextRo = 194210;

function makeReq(at: number): Req {
  const kind = pick(KINDS);
  const side = Math.random() < 0.12;
  const lot = pick(["Lot A", "Lot B", "Lot C"]);
  const spot = side ? "Side Lot" : `${lot} - ${1 + Math.floor(Math.random() * 150)}`;
  nextRo += 3 + Math.floor(Math.random() * 20);
  const blockers = !side && Math.random() < 0.18
    ? Array.from({ length: Math.random() < 0.3 ? 2 : 1 }, () => `RO #${193000 + Math.floor(Math.random() * 1200)} (${pick(CARS)}, ${lot} - ${1 + Math.floor(Math.random() * 150)})`)
    : undefined;
  const dest = kind === "Tech" ? `${pick(TECH_BAYS)} · Tech ${pick(TECHS)}` : undefined;
  return { id: nextId++, kind, ro: String(nextRo), car: pick(CARS), spot, dest, blockers, note: Math.random() < 0.25 ? pick(NOTES) : undefined, at };
}

const LABEL: Record<Kind, string> = { Customer: "Customer here", ETA: "Customer ETA", Tech: "Tech pickup", Parts: "Parts", Park: "Park", Wash: "Wash" };
// Demo-only accent palette mirroring the request-type colors staff see in the app.
const TONE: Record<Kind, { badge: string; card: string }> = {
  Customer: { badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", card: "border-l-emerald-500" },
  ETA: { badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30", card: "border-l-amber-500" },
  Tech: { badge: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30", card: "border-l-sky-500" },
  Parts: { badge: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30", card: "border-l-purple-500" },
  Park: { badge: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30", card: "border-l-indigo-500" },
  Wash: { badge: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30", card: "border-l-cyan-500" },
};
const ago = (ms: number) => { const m = Math.floor(ms / 60000); return m < 1 ? "Just now" : `${m}m ago`; };

function seed() {
  const now = Date.now();
  const claimed: Req[] = [];
  for (let i = 0; i < 14; i++) {
    const at = now - (i * 4 + 1) * 60000 - Math.random() * 120000;
    claimed.push({ ...makeReq(at), by: pick(VALETS), claimedAt: at + 20000 + Math.random() * 40000 });
  }
  const upcoming = [8, 14, 19, 27].map((m) => ({ ...makeReq(now + m * 60000), kind: "ETA" as Kind }));
  return { claimed, upcoming, open: makeReq(now) as Req | null };
}

export function DemoFeed() {
  const [state, setState] = useState(seed);
  const [now, setNow] = useState(Date.now());
  const [pulse, setPulse] = useState(false);
  const [hint, setHint] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const cycle = () => {
      const t1 = window.setTimeout(() => {
        setPulse(true);
        const t2 = window.setTimeout(() => {
          setPulse(false);
          setState((s) => s.open ? { ...s, open: null, claimed: [{ ...s.open, by: pick(VALETS), claimedAt: Date.now() }, ...s.claimed].slice(0, 15) } : s);
          const t3 = window.setTimeout(() => {
            setState((s) => {
              const n = Date.now();
              // An upcoming ETA that has arrived becomes the next request.
              const due = s.upcoming[0] && s.upcoming[0].at - n < 60000;
              const upcoming = due ? [...s.upcoming.slice(1), { ...makeReq(n + (25 + Math.random() * 5) * 60000), kind: "ETA" as Kind }] : s.upcoming;
              return { ...s, upcoming, open: due ? { ...s.upcoming[0], kind: "Customer", at: n } : makeReq(n) };
            });
            cycle();
          }, 1500 + Math.random() * 500);
          timers.current.push(t3);
        }, 700);
        timers.current.push(t2);
      }, 3000 + Math.random() * 1000);
      timers.current.push(t1);
    };
    cycle();
    return () => { clearInterval(tick); timers.current.forEach(clearTimeout); };
  }, []);

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
          <img src={huriLogo.url} alt="Huri" className="h-7 w-auto" />
          <nav className="flex items-center gap-1.5">
            <Link to="/auth" search={{ mode: "business" }} className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted">Business</Link>
            <Link to="/auth" search={{ mode: "register" }} className="rounded-full border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted">Register</Link>
            <Link to="/auth" search={{ mode: "login" }} className="rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">Sign In</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-4">
        <p className="mb-4 text-center text-xs text-muted-foreground">Live demo · simulated service drive</p>

        <Section title="Ready to Claim" count={state.open ? 1 : 0}>
          {state.open ? (
            <Card req={state.open} now={now} className={`transition-all duration-500 animate-in fade-in slide-in-from-top-2 ${pulse ? "ring-2 ring-primary scale-[0.99]" : ""}`}>
              <button type="button" onClick={() => setHint(true)} className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">Claim</button>
            </Card>
          ) : (
            <div className="rounded-xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">Drive clear · 0 cars waiting</div>
          )}
        </Section>

        <Section title="Claimed" count={state.claimed.length}>
          {state.claimed.map((r) => (
            <Card key={r.id} req={r} now={now} className="opacity-90 animate-in fade-in">
              <span className="text-right text-xs text-muted-foreground">Claimed by <b className="text-foreground">{r.by}</b><br />{ago(now - (r.claimedAt ?? now))}</span>
            </Card>
          ))}
        </Section>

        <Section title="Upcoming" count={state.upcoming.length}>
          {state.upcoming.map((r) => (
            <Card key={r.id} req={r} now={now}>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">Arriving in {Math.max(1, Math.ceil((r.at - now) / 60000))}m</span>
            </Card>
          ))}
        </Section>
      </main>

      {hint && (
        <div className="fixed inset-x-0 bottom-0 z-20 p-4" role="dialog" aria-label="Get Huri">
          <div className="mx-auto max-w-md rounded-2xl border bg-background p-4 shadow-lg">
            <p className="font-semibold">This is a demo feed.</p>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to claim real requests, or bring Huri to your dealership.</p>
            <div className="mt-3 flex gap-2">
              <Link to="/auth" search={{ mode: "login" }} className="flex-1 rounded-full bg-primary py-2 text-center text-sm font-semibold text-primary-foreground">Sign In</Link>
              <Link to="/auth" search={{ mode: "business" }} className="flex-1 rounded-full border py-2 text-center text-sm font-medium">Get Huri</Link>
              <button type="button" onClick={() => setHint(false)} className="px-2 text-sm text-muted-foreground">Close</button>
            </div>
          </div>
        </div>
      )}
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

function Card({ req, now, className = "", children }: { req: Req; now: number; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl border border-l-4 bg-background p-3 shadow-sm ${TONE[req.kind].card} ${className}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE[req.kind].badge}`}>{LABEL[req.kind]}</span>
          <span className="text-sm font-semibold">RO #{req.ro}</span>
        </div>
        <p className="mt-1 truncate text-sm">{req.car} · <span className="font-medium">{req.spot}</span>{req.dest && <> → <span className="font-medium">{req.dest}</span></>}</p>
        {req.blockers && <p className="mt-0.5 text-xs text-destructive"><b>Blocked by{req.blockers.length > 1 ? ` ${req.blockers.length} cars` : ""}:</b> {req.blockers.join(", ")}</p>}
        {req.note && <p className="truncate text-xs text-muted-foreground">{req.note}</p>}
        {req.at <= now && !req.by && <p className="text-[11px] text-muted-foreground">{ago(now - req.at)}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

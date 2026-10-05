import { useEffect, useRef, useState } from "react";
import type { Draft } from "@/lib/onboarding-schema";

type Hit = { display_name: string; lat: string; lon: string; name?: string; address?: Record<string, string> };
const inputCls = "w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary";

function F({ label, value, onChange, max }: { label: string; value: string; onChange: (v: string) => void; max: number }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value.slice(0, max))} className={inputCls} />
    </div>
  );
}

/** Business-facing address step: live suggestions, "Is this your address?" confirm, manual fallback. */
export function AddressLookup({ draft, set }: { draft: Draft; set: (fn: (d: Draft) => Draft) => void }) {
  const a = draft.address ?? {};
  const hasAddr = !!(a.street && (a.city || a.zip));
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [manual, setManual] = useState(hasAddr);
  const [rejected, setRejected] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const text = q.trim();
    setRejected(false);
    if (text.length < 3) { setHits([]); setFailed(false); return; }
    const my = ++seq.current;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(text)}`, { headers: { Accept: "application/json" } });
        if (!r.ok) throw new Error();
        const j = (await r.json()) as Hit[];
        if (my === seq.current) { setHits(j); setFailed(false); }
      } catch { if (my === seq.current) { setHits([]); setFailed(true); } }
      finally { if (my === seq.current) setBusy(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (r: Hit) => {
    const ad = r.address ?? {};
    const lat = +(+r.lat).toFixed(7), lng = +(+r.lon).toFixed(7);
    set((d) => ({
      ...d, center: { lat, lng, zoom: 18 },
      address: {
        ...d.address,
        street: [ad.house_number, ad.road].filter(Boolean).join(" ") || d.address?.street,
        city: ad.city || ad.town || ad.village || d.address?.city,
        state: ad.state || d.address?.state, zip: ad.postcode || d.address?.zip, country: ad.country || d.address?.country,
      },
    }));
    setHits([]); setQ(""); setManual(true);
  };
  const setA = (k: keyof NonNullable<Draft["address"]>) => (v: string) => set((d) => ({ ...d, address: { ...d.address, [k]: v } }));

  // A place/business-name result (has a name, not just an address) → confirm prompt.
  const top = hits[0];
  const looksPlace = !!top && !!top.name && !/^\d/.test(q.trim()) && !rejected;

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Search your business name or address</label>
        <input value={q} onChange={(e) => setQ(e.target.value.slice(0, 200))} placeholder="e.g. Sunset Motors or 123 Main St" className={inputCls} />
        {busy && <p className="mt-1 text-[11px] text-muted-foreground">Searching…</p>}
        {looksPlace ? (
          <div className="mt-2 rounded-xl border border-primary bg-primary/5 p-3">
            <p className="text-sm font-semibold">Is this your address?</p>
            <p className="mt-1 text-sm">{top.display_name}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => pick(top)} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground">Confirm</button>
              <button type="button" onClick={() => setRejected(true)} className="flex-1 rounded-xl bg-muted py-2.5 text-sm font-medium">That's not it</button>
            </div>
          </div>
        ) : hits.length > 0 && (
          <ul className="mt-2 overflow-hidden rounded-xl border border-border bg-background">
            {hits.map((r, i) => <li key={i}><button type="button" onClick={() => pick(r)} className="w-full px-3 py-2.5 text-left text-sm active:bg-accent">{r.display_name}</button></li>)}
          </ul>
        )}
        {q.trim().length >= 3 && !busy && (failed || !hits.length) && (
          <p className="mt-1 text-[11px] text-muted-foreground">{failed ? "Search isn't available right now." : "No match found."} Enter your address below.</p>
        )}
        {!manual && (
          <button type="button" onClick={() => setManual(true)} className="mt-2 text-sm font-medium text-primary underline">Enter address manually</button>
        )}
      </div>
      {(manual || rejected || failed || (q.trim().length >= 3 && !busy && !hits.length)) && (
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2"><F label="Street address" value={a.street ?? ""} onChange={setA("street")} max={200} /></div>
          <F label="City" value={a.city ?? ""} onChange={setA("city")} max={100} />
          <F label="State / province" value={a.state ?? ""} onChange={setA("state")} max={100} />
          <F label="ZIP / postal code" value={a.zip ?? ""} onChange={setA("zip")} max={20} />
          <F label="Country" value={a.country ?? ""} onChange={setA("country")} max={80} />
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Property notes (optional)</label>
        <textarea value={a.notes ?? ""} rows={3} onChange={(e) => setA("notes")(e.target.value.slice(0, 2000))}
          placeholder="Anything Huri should know before mapping your lots" className={inputCls} />
      </div>
    </div>
  );
}

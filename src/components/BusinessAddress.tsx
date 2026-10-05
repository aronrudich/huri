import { useEffect, useRef, useState } from "react";

export type Addr = { street: string; city: string; state: string; zip: string; formatted: string; lat: number | null; lng: number | null; confirmed: boolean };
export const emptyAddr: Addr = { street: "", city: "", state: "", zip: "", formatted: "", lat: null, lng: null, confirmed: false };
export const addrComplete = (a: Addr) => !!(a.street.trim() && a.city.trim() && a.state.trim() && a.zip.trim());

type Hit = { display_name: string; lat: string; lon: string; address?: Record<string, string> };
const inputCls = "w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary";

function toAddr(h: Hit): Addr {
  const ad = h.address ?? {};
  return {
    street: [ad.house_number, ad.road].filter(Boolean).join(" "),
    city: ad.city || ad.town || ad.village || ad.hamlet || "",
    state: ad.state || "",
    zip: ad.postcode || "",
    formatted: h.display_name.slice(0, 500),
    lat: +(+h.lat).toFixed(7), lng: +(+h.lon).toFixed(7),
    confirmed: true,
  };
}

/** Looks up the address from the business name as it's typed; manual entry fallback. */
export function BusinessAddress({ name, value, onChange }: { name: string; value: Addr; onChange: (a: Addr) => void }) {
  const [hit, setHit] = useState<Hit | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const q = name.trim();
    if (value.confirmed || manual || q.length < 3) { setHit(null); return; }
    const my = ++seq.current;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=3&q=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } });
        if (!r.ok) throw new Error();
        const j = ((await r.json()) as Hit[]).filter((h) => h.display_name !== rejected);
        if (my === seq.current) { setHit(j[0] ?? null); if (!j[0]) setManual(true); }
      } catch { if (my === seq.current) { setHit(null); setManual(true); } }
      finally { if (my === seq.current) setBusy(false); }
    }, 600);
    return () => clearTimeout(t);
  }, [name, value.confirmed, manual, rejected]);

  const setF = (k: "street" | "city" | "state" | "zip") => (v: string) =>
    onChange({ ...value, [k]: v, formatted: "", lat: null, lng: null, confirmed: false });

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">Address</label>
      {value.confirmed ? (
        <div className="flex items-start gap-3 rounded-xl border border-success bg-success/10 p-3">
          <p className="flex-1 text-sm">✓ {value.formatted}</p>
          <button type="button" onClick={() => { onChange(emptyAddr); setManual(false); }} className="text-sm font-medium text-primary">Change</button>
        </div>
      ) : manual ? (
        <div className="space-y-2">
          <input value={value.street} onChange={(e) => setF("street")(e.target.value.slice(0, 200))} placeholder="Street address" autoComplete="street-address" className={inputCls} />
          <div className="grid grid-cols-2 gap-2">
            <input value={value.city} onChange={(e) => setF("city")(e.target.value.slice(0, 100))} placeholder="City" autoComplete="address-level2" className={inputCls} />
            <input value={value.state} onChange={(e) => setF("state")(e.target.value.slice(0, 100))} placeholder="State" autoComplete="address-level1" className={inputCls} />
          </div>
          <input value={value.zip} onChange={(e) => setF("zip")(e.target.value.slice(0, 20))} placeholder="ZIP code" autoComplete="postal-code" inputMode="numeric" className={inputCls} />
          {name.trim().length >= 3 && (
            <button type="button" onClick={() => { setRejected(null); setManual(false); }} className="text-xs font-medium text-primary">Search by business name again</button>
          )}
        </div>
      ) : hit ? (
        <div className="rounded-xl border border-primary bg-primary/5 p-3">
          <p className="text-sm font-semibold">Is this your address?</p>
          <p className="mt-1 text-sm">{hit.display_name}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => { const a = toAddr(hit); onChange(a); if (!addrComplete(a)) { setManual(true); onChange({ ...a, confirmed: false }); } }} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground">Confirm Address</button>
            <button type="button" onClick={() => { setRejected(hit.display_name); setHit(null); setManual(true); }} className="flex-1 rounded-xl bg-muted py-2.5 text-sm font-medium">That's not it</button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-input p-3 text-sm text-muted-foreground">
          {busy ? "Looking up your address…" : "Type your business name above and we'll find your address."}
          <button type="button" onClick={() => setManual(true)} className="mt-1 block font-medium text-primary">Enter manually</button>
        </div>
      )}
    </div>
  );
}

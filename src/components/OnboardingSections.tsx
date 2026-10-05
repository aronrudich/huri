// Map-wizard sections shared by the business onboarding link and Huri Support review.
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Search, Trash2, Undo2 } from "lucide-react";
import { PropertyMap, type MapMode } from "./PropertyMap";
import {
  LOT_CATEGORIES, draftStats, duplicateSpotLabels, lotsOutside, newId, pointsAlong,
  type Draft, type LatLng, type Lot, type Row, type Spot,
} from "@/lib/onboarding-schema";

type P = { draft: Draft; set: (fn: (d: Draft) => Draft) => void; readOnly?: boolean };
type Fly = { lat: number; lng: number; zoom?: number; key: number } | null;

const btn = "rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-50";
const inputCls = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-base outline-none focus:border-primary";

export function Field({ label, value, onChange, max, type = "text", disabled }: { label: string; value: string; onChange: (v: string) => void; max: number; type?: string; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <input value={value} type={type} disabled={disabled} onChange={(e) => onChange(e.target.value.slice(0, max))} className={inputCls} />
    </label>
  );
}

// ---------- Address ----------
export function AddressSection({ draft, set, readOnly }: P) {
  const a = draft.address ?? {};
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ display_name: string; lat: string; lon: string; address?: Record<string, string> }[]>([]);
  const [busy, setBusy] = useState(false);
  const [fly, setFly] = useState<Fly>(null);
  const setA = (k: keyof NonNullable<Draft["address"]>) => (v: string) => set((d) => ({ ...d, address: { ...d.address, [k]: v } }));

  const search = async (text: string) => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(text)}`, { headers: { Accept: "application/json" } });
      const j = await r.json();
      setResults(j);
      if (!j.length) toast.error("Address not found. Type it below and place the map by hand.");
    } catch { toast.error("Address search is unavailable right now. Enter it by hand and move the map."); }
    finally { setBusy(false); }
  };
  const pick = (r: (typeof results)[number]) => {
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
    setFly({ lat, lng, zoom: 18, key: Date.now() });
    setResults([]);
  };
  const manualQuery = [a.street, a.city, a.state, a.zip, a.country].filter(Boolean).join(", ");

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div>
          <div className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value.slice(0, 200))} onKeyDown={(e) => e.key === "Enter" && search(q)}
              placeholder="Search your business address" className={inputCls} />
            <button onClick={() => search(q)} disabled={busy} className="grid w-12 place-items-center rounded-xl bg-primary text-primary-foreground" aria-label="Search"><Search className="h-5 w-5" /></button>
          </div>
          {results.length > 0 && (
            <ul className="mt-2 overflow-hidden rounded-xl border border-border bg-background">
              {results.map((r, i) => <li key={i}><button onClick={() => pick(r)} className="w-full px-3 py-2.5 text-left text-sm active:bg-accent">{r.display_name}</button></li>)}
            </ul>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2"><Field label="Street address" value={a.street ?? ""} onChange={setA("street")} max={200} disabled={readOnly} /></div>
        <Field label="City" value={a.city ?? ""} onChange={setA("city")} max={100} disabled={readOnly} />
        <Field label="State / province" value={a.state ?? ""} onChange={setA("state")} max={100} disabled={readOnly} />
        <Field label="ZIP / postal code" value={a.zip ?? ""} onChange={setA("zip")} max={20} disabled={readOnly} />
        <Field label="Country" value={a.country ?? ""} onChange={setA("country")} max={80} disabled={readOnly} />
      </div>
      {!readOnly && <button onClick={() => search(manualQuery)} disabled={busy || !manualQuery} className={`${btn} bg-muted`}>Find property on map</button>}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Property notes (optional)</span>
        <textarea value={a.notes ?? ""} disabled={readOnly} onChange={(e) => setA("notes")(e.target.value.slice(0, 2000))} rows={2} className={inputCls} />
      </label>
      <p className="text-xs text-muted-foreground">Drag the map so your property is in the middle. We'll save that spot.</p>
      <PropertyMap data={draft} mode={{ kind: "view" }} height={300} flyTo={fly} />
      {!readOnly && <CenterHere draft={draft} set={set} />}
    </div>
  );
}

function CenterHere({ draft, set }: P) {
  return (
    <p className="text-xs text-muted-foreground">
      {draft.center ? `Saved location: ${draft.center.lat.toFixed(5)}, ${draft.center.lng.toFixed(5)}` : "No location saved yet — search above."}
      {" "}
      <button className="font-semibold text-primary" onClick={() => {
        const m = (window as unknown as { __huriLastCenter?: { lat: number; lng: number } }).__huriLastCenter;
        if (m) set((d) => ({ ...d, center: { ...m, zoom: 18 } }));
      }} hidden />
    </p>
  );
}

// ---------- Property boundary ----------
export function PropertySection({ draft, set, readOnly }: P) {
  const [drawing, setDrawing] = useState(false);
  const b = draft.boundary ?? [];
  const onShape = useCallback((pts: LatLng[]) => set((d) => ({ ...d, boundary: pts, boundaryConfirmed: false })), [set]);
  return (
    <div className="space-y-3">
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Switch to <b className="text-foreground">Satellite</b> view if it helps you see your building and parking areas.</li>
        <li>Trace the outside edge of the property Huri will manage. Tap each corner in order.</li>
      </ul>
      <PropertyMap data={draft} mode={drawing && !readOnly ? { kind: "boundary" } : { kind: "view" }} height={440} onShape={onShape} />
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setDrawing(!drawing)} className={`${btn} ${drawing ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground"}`}>
            {drawing ? "Done drawing" : b.length ? "Edit boundary points" : "Start drawing property boundary"}
          </button>
          <button disabled={!b.length} onClick={() => onShape(b.slice(0, -1))} className={`${btn} bg-muted`}><Undo2 className="mr-1 inline h-3.5 w-3.5" />Undo point</button>
          <button disabled={!b.length} onClick={() => confirm("Delete the property boundary?") && onShape([])} className={`${btn} bg-destructive/10 text-destructive`}>Delete boundary</button>
        </div>
      )}
      {drawing && <p className="text-xs text-muted-foreground">Tap the map to add corners. Drag a numbered dot to move it.</p>}
      <p className="text-xs text-muted-foreground">{b.length >= 3 ? `Boundary has ${b.length} corners.` : "Add at least 3 corners."}</p>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1 h-4 w-4" disabled={readOnly || b.length < 3} checked={!!draft.boundaryConfirmed}
          onChange={(e) => set((d) => ({ ...d, boundaryConfirmed: e.target.checked }))} />
        This boundary represents the property or areas Huri should manage.
      </label>
    </div>
  );
}

// ---------- Lots ----------
export function LotsSection({ draft, set, readOnly }: P) {
  const lots = draft.lots ?? [];
  const [active, setActive] = useState<string | null>(null);
  const upd = (id: string, patch: Partial<Lot>) => set((d) => ({ ...d, lots: (d.lots ?? []).map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const onShape = useCallback((pts: LatLng[]) => { if (active) upd(active, { polygon: pts }); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  const add = () => {
    const id = newId();
    set((d) => ({ ...d, lots: [...(d.lots ?? []), { id, name: "", polygon: [] }] }));
    setActive(id);
  };
  const remove = (id: string) => {
    if (!confirm("Delete this lot and its rows and spots?")) return;
    set((d) => ({ ...d, lots: (d.lots ?? []).filter((l) => l.id !== id), rows: (d.rows ?? []).filter((r) => r.lotId !== id), spots: (d.spots ?? []).filter((s) => s.lotId !== id) }));
    if (active === id) setActive(null);
  };
  const move = (i: number, dir: -1 | 1) => set((d) => {
    const a = [...(d.lots ?? [])]; const j = i + dir; if (j < 0 || j >= a.length) return d;
    [a[i], a[j]] = [a[j], a[i]]; return { ...d, lots: a };
  });
  const outside = lotsOutside(draft).map((l) => l.id);
  const mode: MapMode = active && !readOnly ? { kind: "lot", lotId: active } : { kind: "view" };
  const cur = lots.find((l) => l.id === active);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Add each lot — like Service Drive, Back Lot, or Customer Pickup — and trace it on the map. Satellite view makes paved areas easier to see.</p>
      <PropertyMap data={draft} mode={mode} height={420} onShape={onShape} />
      {cur && !readOnly && (
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-xs text-muted-foreground">Tracing <b>{cur.name || "new lot"}</b> — tap corners on the map.</span>
          <button disabled={!cur.polygon.length} onClick={() => upd(cur.id, { polygon: cur.polygon.slice(0, -1) })} className={`${btn} bg-muted`}>Undo point</button>
          <button disabled={!cur.polygon.length} onClick={() => upd(cur.id, { polygon: [] })} className={`${btn} bg-muted`}>Clear shape</button>
          <button onClick={() => setActive(null)} className={`${btn} bg-success text-success-foreground`}>Done</button>
        </div>
      )}
      <ul className="space-y-2">
        {lots.map((l, i) => (
          <li key={l.id} className={`rounded-xl border p-3 ${active === l.id ? "border-primary" : "border-border"}`}>
            <div className="flex gap-2">
              <input value={l.name} disabled={readOnly} placeholder="Lot name" onChange={(e) => upd(l.id, { name: e.target.value.slice(0, 120) })} className={inputCls} />
              {!readOnly && <>
                <button onClick={() => move(i, -1)} aria-label="Move up" className="px-1"><ArrowUp className="h-4 w-4" /></button>
                <button onClick={() => move(i, 1)} aria-label="Move down" className="px-1"><ArrowDown className="h-4 w-4" /></button>
                <button onClick={() => remove(l.id)} aria-label="Delete lot" className="px-1 text-destructive"><Trash2 className="h-4 w-4" /></button>
              </>}
            </div>
            <div className="mt-2 flex gap-2">
              <select value={l.category ?? ""} disabled={readOnly} onChange={(e) => upd(l.id, { category: (e.target.value || undefined) as Lot["category"] })} className={`${inputCls} py-2 text-sm`}>
                <option value="">Category (optional)</option>
                {LOT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              {!readOnly && <button onClick={() => setActive(active === l.id ? null : l.id)} className={`${btn} shrink-0 bg-primary text-primary-foreground`}>{l.polygon.length ? "Edit shape" : "Draw shape"}</button>}
            </div>
            <input value={l.description ?? ""} disabled={readOnly} placeholder="Description (optional)" onChange={(e) => upd(l.id, { description: e.target.value.slice(0, 1000) })} className={`${inputCls} mt-2 text-sm`} />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {l.polygon.length >= 3 ? `${l.polygon.length} corners` : "Needs a shape (3+ corners)"}{!l.name.trim() && " · needs a name"}
              {outside.includes(l.id) && <span className="text-warning"> · Looks mostly outside the property boundary — that's okay if intended.</span>}
            </p>
          </li>
        ))}
      </ul>
      {!readOnly && <button onClick={add} className={`${btn} w-full bg-muted py-3`}>+ Add lot</button>}
    </div>
  );
}

// ---------- Rows & spots ----------
export function RowsSpotsSection({ draft, set, readOnly }: P) {
  const lots = (draft.lots ?? []).filter((l) => l.polygon.length >= 3);
  const [lotId, setLotId] = useState<string>(lots[0]?.id ?? "");
  const [activeRow, setActiveRow] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [gen, setGen] = useState({ rowId: "", count: 10, prefix: "", start: 1 });
  const rows = (draft.rows ?? []).filter((r) => r.lotId === lotId);
  const spots = (draft.spots ?? []).filter((s) => s.lotId === lotId);
  const updRow = (id: string, patch: Partial<Row>) => set((d) => ({ ...d, rows: (d.rows ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const updSpot = (id: string, patch: Partial<Spot>) => set((d) => ({ ...d, spots: (d.spots ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const onShape = useCallback((pts: LatLng[]) => { if (activeRow) updRow(activeRow, { line: pts }); }, [activeRow]); // eslint-disable-line react-hooks/exhaustive-deps
  const nextLabel = () => {
    const nums = spots.map((s) => parseInt(s.label.replace(/\D+/g, ""), 10)).filter(Number.isFinite);
    return String((nums.length ? Math.max(...nums) : 0) + 1);
  };
  const onAddSpot = useCallback((p: LatLng) => {
    if ((draft.spots?.length ?? 0) >= 4000) return toast.error("Spot limit reached");
    const id = newId();
    set((d) => ({ ...d, spots: [...(d.spots ?? []), { id, lotId, label: nextLabel(), lat: p[0], lng: p[1] }] }));
    setSel(id);
  }, [lotId, spots, draft.spots?.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const onMoveSpot = useCallback((id: string, p: LatLng) => updSpot(id, { lat: p[0], lng: p[1] }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const addRow = () => {
    const id = newId();
    set((d) => ({ ...d, rows: [...(d.rows ?? []), { id, lotId, label: String.fromCharCode(65 + (rows.length % 26)), line: [] }] }));
    setActiveRow(id); setPlacing(false);
  };
  const generate = () => {
    const r = rows.find((x) => x.id === gen.rowId);
    if (!r || r.line.length < 2) return toast.error("Pick a row that has a drawn line");
    const n = Math.max(1, Math.min(300, gen.count));
    const pts = pointsAlong(r.line, n);
    const made: Spot[] = pts.map((p, k) => ({ id: newId() + k, lotId, rowId: r.id, label: `${gen.prefix}${gen.start + k}`.slice(0, 40), lat: +p[0].toFixed(7), lng: +p[1].toFixed(7) }));
    const existing = new Set(spots.map((s) => s.label.toUpperCase()));
    const clash = made.filter((s) => existing.has(s.label.toUpperCase())).length;
    if (clash && !confirm(`${clash} of these labels already exist in this lot. Add anyway?`)) return;
    set((d) => ({ ...d, spots: [...(d.spots ?? []), ...made], rows: (d.rows ?? []).map((x) => x.id === r.id ? { ...x, start: gen.start, end: gen.start + n - 1 } : x) }));
    toast.success(`Added ${n} spots`);
  };

  if (!lots.length) return <p className="rounded-xl bg-muted p-4 text-sm">Add at least one lot with a shape first.</p>;
  const mode: MapMode = readOnly ? { kind: "view" } : activeRow ? { kind: "row", rowId: activeRow } : placing ? { kind: "spot", lotId } : { kind: "view" };
  const selSpot = spots.find((s) => s.id === sel);
  const dups = duplicateSpotLabels(draft);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Add rows and parking spots for each lot. Keep it simple — Huri Support will review and refine the layout before activation.</p>
      <select value={lotId} onChange={(e) => { setLotId(e.target.value); setActiveRow(null); setPlacing(false); setSel(null); }} className={inputCls}>
        {lots.map((l) => <option key={l.id} value={l.id}>{l.name || "Unnamed lot"}</option>)}
      </select>
      <PropertyMap data={draft} mode={mode} height={420} selectedSpotId={sel} onShape={onShape} onAddSpot={onAddSpot} onMoveSpot={onMoveSpot} onSelectSpot={setSel} />
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <button onClick={addRow} className={`${btn} bg-muted`}>+ Draw a row</button>
          <button onClick={() => { setPlacing(!placing); setActiveRow(null); }} className={`${btn} ${placing ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground"}`}>
            {placing ? "Done placing spots" : "Tap to place spots"}
          </button>
        </div>
      )}
      {activeRow && <p className="text-xs text-muted-foreground">Tap where the row starts, then where it ends (add bends if needed). Spot numbers run start → end (the dot marks the end).</p>}
      {placing && <p className="text-xs text-muted-foreground">Tap the map to drop a spot. Drag spots to move them; tap one to rename or delete.</p>}

      {selSpot && !readOnly && (
        <div className="flex items-center gap-2 rounded-xl border border-primary p-2">
          <span className="text-xs text-muted-foreground">Spot</span>
          <input value={selSpot.label} onChange={(e) => updSpot(selSpot.id, { label: e.target.value.slice(0, 40) })} className={`${inputCls} py-2`} />
          <button onClick={() => { set((d) => ({ ...d, spots: (d.spots ?? []).filter((s) => s.id !== selSpot.id) })); setSel(null); }} className="px-2 text-destructive" aria-label="Delete spot"><Trash2 className="h-4 w-4" /></button>
        </div>
      )}
      {dups.length > 0 && <p className="text-xs text-warning">Duplicate spot labels: {dups.slice(0, 8).join(", ")}. Rename them so each spot is unique.</p>}

      <div className="space-y-2">
        <p className="text-xs font-semibold">Rows in this lot</p>
        {rows.length === 0 && <p className="text-xs text-muted-foreground">No rows yet.</p>}
        {rows.map((r) => (
          <div key={r.id} className={`flex items-center gap-2 rounded-xl border p-2 ${activeRow === r.id ? "border-primary" : "border-border"}`}>
            <input value={r.label} disabled={readOnly} onChange={(e) => updRow(r.id, { label: e.target.value.slice(0, 60) })} className={`${inputCls} py-2`} />
            <span className="shrink-0 text-[11px] text-muted-foreground">{r.line.length} pts{r.start != null ? ` · ${r.start}–${r.end}` : ""}</span>
            {!readOnly && <>
              <button onClick={() => { setActiveRow(activeRow === r.id ? null : r.id); setPlacing(false); }} className={`${btn} shrink-0 bg-muted`}>{activeRow === r.id ? "Done" : "Edit line"}</button>
              <button onClick={() => { if (confirm("Delete row? Its spots stay.")) { set((d) => ({ ...d, rows: (d.rows ?? []).filter((x) => x.id !== r.id), spots: (d.spots ?? []).map((s) => s.rowId === r.id ? { ...s, rowId: undefined } : s) })); setActiveRow(null); } }} className="px-1 text-destructive" aria-label="Delete row"><Trash2 className="h-4 w-4" /></button>
            </>}
          </div>
        ))}
      </div>

      {!readOnly && rows.length > 0 && (
        <div className="rounded-xl bg-muted/60 p-3">
          <p className="mb-2 text-xs font-semibold">Generate spots along a row</p>
          <div className="grid grid-cols-2 gap-2">
            <select value={gen.rowId} onChange={(e) => setGen({ ...gen, rowId: e.target.value })} className={`${inputCls} col-span-2 py-2 text-sm`}>
              <option value="">Choose row</option>
              {rows.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <Field label="How many spots" type="number" value={String(gen.count)} onChange={(v) => setGen({ ...gen, count: parseInt(v || "0", 10) || 0 })} max={3} />
            <Field label="Start number" type="number" value={String(gen.start)} onChange={(v) => setGen({ ...gen, start: parseInt(v || "0", 10) || 0 })} max={5} />
            <div className="col-span-2"><Field label="Label prefix (e.g. A-)" value={gen.prefix} onChange={(v) => setGen({ ...gen, prefix: v })} max={20} /></div>
          </div>
          <button onClick={generate} className={`${btn} mt-2 w-full bg-primary py-3 text-primary-foreground`}>Generate spots</button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{spots.length} spots in this lot · {draft.spots?.length ?? 0} total</p>
    </div>
  );
}

// ---------- Auction barcodes ----------
export function BarcodeSection({ draft, set, readOnly }: P) {
  const b = draft.barcode ?? {};
  const setB = (patch: Partial<NonNullable<Draft["barcode"]>>) => set((d) => ({ ...d, barcode: { ...d.barcode, ...patch } }));
  const scan = async (file: File) => {
    const BD = (window as unknown as { BarcodeDetector?: new () => { detect: (i: ImageBitmap) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    if (!BD) return toast.error("This browser can't read barcodes. Type the sample below instead.");
    try {
      const res = await new BD().detect(await createImageBitmap(file));
      if (!res.length) return toast.error("No barcode found in that photo. Type it below instead.");
      setB({ sample: res[0].rawValue.slice(0, 300) });
      toast.success("Barcode read");
    } catch { toast.error("Couldn't read that barcode. Type it below instead."); }
  };
  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <p className="text-sm font-semibold">Barcode setup (optional)</p>
      <p className="text-xs text-muted-foreground">Do you already use vehicle barcodes?</p>
      <div className="flex gap-2">
        {(["yes", "no", "unsure"] as const).map((v) => (
          <button key={v} disabled={readOnly} onClick={() => setB({ uses: v })} className={`flex-1 rounded-xl border py-2 text-sm ${b.uses === v ? "border-primary bg-primary/10 text-primary" : "border-input"}`}>
            {v === "yes" ? "Yes" : v === "no" ? "No" : "Not sure"}
          </button>
        ))}
      </div>
      <textarea value={b.notes ?? ""} disabled={readOnly} placeholder="Barcode format or auction software (optional)" onChange={(e) => setB({ notes: e.target.value.slice(0, 2000) })} rows={2} className={inputCls} />
      {!readOnly && (
        <label className={`${btn} inline-block cursor-pointer bg-muted`}>
          Scan a sample barcode
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && scan(e.target.files[0])} />
        </label>
      )}
      <Field label="Sample barcode value" value={b.sample ?? ""} onChange={(v) => setB({ sample: v })} max={300} disabled={readOnly} />
    </div>
  );
}

// ---------- Review summary ----------
export function ReviewSummary({ draft, onEdit }: { draft: Draft; onEdit?: (step: number) => void }) {
  const s = draftStats(draft);
  const a = draft.address ?? {};
  const Row = ({ label, value, step }: { label: string; value: string; step: number }) => (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2 text-sm last:border-0">
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="whitespace-pre-wrap">{value || "—"}</p></div>
      {onEdit && <button onClick={() => onEdit(step)} className="text-xs font-semibold text-primary">Edit</button>}
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border px-3">
        <Row label="Business" step={1} value={`${draft.businessName ?? ""} · ${draft.businessType === "auction" ? "Auction" : "Dealership"}\n${[draft.contactName, draft.contactEmail, draft.contactPhone].filter(Boolean).join(" · ")}`} />
        <Row label="Address" step={2} value={[a.street, a.city, a.state, a.zip, a.country].filter(Boolean).join(", ")} />
        <Row label="Property boundary" step={3} value={s.boundary ? "Drawn" : "Missing"} />
        <Row label="Lots" step={4} value={String(s.lots)} />
        <Row label="Rows / spots" step={5} value={`${s.rows} rows · ${s.spots} spots`} />
        {draft.businessType === "auction" && <Row label="Barcodes" step={5} value={`${draft.barcode?.uses ?? "Not answered"}${draft.barcode?.sample ? ` · sample ${draft.barcode.sample}` : ""}`} />}
      </div>
      <PropertyMap data={draft} mode={{ kind: "view" }} height={340} />
    </div>
  );
}

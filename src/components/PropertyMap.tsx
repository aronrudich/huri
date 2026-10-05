// Interactive property map (Leaflet, no API key): OpenStreetMap standard tiles
// plus Esri World Imagery satellite tiles. Leaflet is loaded after mount so SSR never touches it.
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { Crosshair, Map as MapIcon, Satellite } from "lucide-react";
import type { Draft, LatLng } from "@/lib/onboarding-schema";

export type MapMode =
  | { kind: "view" }
  | { kind: "boundary" }
  | { kind: "lot"; lotId: string }
  | { kind: "row"; rowId: string }
  | { kind: "spot"; lotId: string };

type Props = {
  data: Draft;
  mode: MapMode;
  height?: number | string;
  selectedSpotId?: string | null;
  onShape?: (pts: LatLng[]) => void; // boundary / active lot / active row
  onAddSpot?: (p: LatLng) => void;
  onMoveSpot?: (id: string, p: LatLng) => void;
  onSelectSpot?: (id: string) => void;
  flyTo?: { lat: number; lng: number; zoom?: number; key: number } | null;
};

let layerPref: "standard" | "satellite" = "standard";

export function PropertyMap({ data, mode, height = 420, selectedSpotId, onShape, onAddSpot, onMoveSpot, onSelectSpot, flyTo }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const tiles = useRef<{ standard: Leaflet.TileLayer; satellite: Leaflet.TileLayer } | null>(null);
  const group = useRef<Leaflet.LayerGroup | null>(null);
  const [ready, setReady] = useState(false);
  const [layer, setLayer] = useState(layerPref);
  const [tileError, setTileError] = useState(false);
  const latest = useRef({ data, mode, onShape, onAddSpot });
  latest.current = { data, mode, onShape, onAddSpot };

  useEffect(() => {
    let dead = false;
    import("leaflet").then((mod) => {
      if (dead || !el.current) return;
      const Lf = (mod as unknown as { default: typeof Leaflet }).default ?? mod;
      L.current = Lf;
      const c = data.center;
      const m = Lf.map(el.current, { zoomControl: true, attributionControl: true }).setView(c ? [c.lat, c.lng] : [39.5, -98.35], c ? c.zoom ?? 18 : 4);
      const standard = Lf.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 20, maxNativeZoom: 19, attribution: "© OpenStreetMap contributors",
      });
      const satellite = Lf.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 20, maxNativeZoom: 19, attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
      });
      satellite.on("tileerror", () => setTileError(true));
      (layerPref === "satellite" ? satellite : standard).addTo(m);
      tiles.current = { standard, satellite };
      group.current = Lf.layerGroup().addTo(m);
      m.on("click", (e: Leaflet.LeafletMouseEvent) => {
        const { mode: md, data: d, onShape: os, onAddSpot: oa } = latest.current;
        const p: LatLng = [+e.latlng.lat.toFixed(7), +e.latlng.lng.toFixed(7)];
        if (md.kind === "spot") return oa?.(p);
        const cur = currentShape(d, md);
        if (!cur || !os) return;
        if (md.kind === "row" && cur.length >= 50) return;
        os([...cur, p]);
      });
      map.current = m;
      setReady(true);
    });
    return () => { dead = true; map.current?.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!flyTo || !map.current) return;
    map.current.setView([flyTo.lat, flyTo.lng], flyTo.zoom ?? 18);
  }, [flyTo]);

  const switchLayer = (to: "standard" | "satellite") => {
    if (!map.current || !tiles.current) return;
    map.current.removeLayer(tiles.current[layer]);
    tiles.current[to].addTo(map.current);
    tiles.current[to].bringToBack();
    layerPref = to; setLayer(to); setTileError(false);
  };

  const recenter = () => {
    const m = map.current, Lf = L.current; if (!m || !Lf) return;
    const pts = [...(data.boundary ?? []), ...(data.lots ?? []).flatMap((l) => l.polygon)];
    if (pts.length >= 2) m.fitBounds(Lf.latLngBounds(pts), { padding: [24, 24] });
    else if (data.center) m.setView([data.center.lat, data.center.lng], data.center.zoom ?? 18);
  };

  // Redraw shapes whenever data / mode changes.
  useEffect(() => {
    const Lf = L.current, g = group.current; if (!ready || !Lf || !g) return;
    g.clearLayers();
    const editing = mode.kind !== "view";
    const b = data.boundary ?? [];
    if (b.length >= 2) {
      const cls = mode.kind === "boundary" ? "hm-boundary hm-active" : editing ? "hm-boundary hm-dim" : "hm-boundary";
      (b.length >= 3 ? Lf.polygon(b, { className: cls }) : Lf.polyline(b, { className: cls })).addTo(g);
    }
    (data.lots ?? []).forEach((lot, i) => {
      if (lot.polygon.length < 2) return;
      const active = mode.kind === "lot" && mode.lotId === lot.id || mode.kind === "spot" && mode.lotId === lot.id;
      const cls = `hm-lot hm-lot-${i % 6}${active ? " hm-active" : ""}`;
      const shape = lot.polygon.length >= 3 ? Lf.polygon(lot.polygon, { className: cls }) : Lf.polyline(lot.polygon, { className: cls });
      shape.bindTooltip(lot.name || "Lot", { permanent: true, direction: "center", className: "hm-label" }).addTo(g);
    });
    (data.rows ?? []).forEach((r) => {
      if (r.line.length < 2) return;
      const active = mode.kind === "row" && mode.rowId === r.id;
      Lf.polyline(r.line, { className: `hm-row${active ? " hm-active" : ""}` })
        .bindTooltip(r.label || "Row", { direction: "top", className: "hm-label" }).addTo(g);
      // direction arrow at the end
      Lf.circleMarker(r.line[r.line.length - 1], { radius: 4, className: "hm-row-end" }).addTo(g);
    });
    const spotEdit = mode.kind === "spot";
    (data.spots ?? []).forEach((s) => {
      const sel = s.id === selectedSpotId;
      const icon = Lf.divIcon({ className: "", html: `<div class="hm-spot${sel ? " hm-spot-sel" : ""}">${escapeHtml(s.label)}</div>`, iconSize: [0, 0] });
      const mk = Lf.marker([s.lat, s.lng], { icon, draggable: spotEdit && mode.lotId === s.lotId, keyboard: false });
      mk.on("click", (e) => { Lf.DomEvent.stopPropagation(e); onSelectSpot?.(s.id); });
      mk.on("dragend", () => { const ll = mk.getLatLng(); onMoveSpot?.(s.id, [+ll.lat.toFixed(7), +ll.lng.toFixed(7)]); });
      mk.addTo(g);
    });
    const cur = currentShape(data, mode);
    if (cur && onShape) {
      cur.forEach((p, idx) => {
        const icon = Lf.divIcon({ className: "", html: `<div class="hm-vertex">${idx + 1}</div>`, iconSize: [0, 0] });
        const mk = Lf.marker(p, { icon, draggable: true, keyboard: false });
        mk.on("click", (e) => Lf.DomEvent.stopPropagation(e));
        mk.on("dragend", () => {
          const ll = mk.getLatLng();
          const next = cur.slice(); next[idx] = [+ll.lat.toFixed(7), +ll.lng.toFixed(7)];
          onShape(next);
        });
        mk.addTo(g);
      });
    }
  }, [ready, data, mode, selectedSpotId, onShape, onMoveSpot, onSelectSpot]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-muted" style={{ height }}>
      <div ref={el} className="h-full w-full" />
      {!ready && <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Loading map…</p>}
      <div className="absolute right-2 top-2 z-[500] flex overflow-hidden rounded-full bg-background shadow-md">
        <button type="button" onClick={() => switchLayer("standard")}
          className={`flex items-center gap-1 px-3 py-2 text-xs font-semibold ${layer === "standard" ? "bg-primary text-primary-foreground" : ""}`}>
          <MapIcon className="h-3.5 w-3.5" /> Standard
        </button>
        <button type="button" onClick={() => switchLayer("satellite")}
          className={`flex items-center gap-1 px-3 py-2 text-xs font-semibold ${layer === "satellite" ? "bg-primary text-primary-foreground" : ""}`}>
          <Satellite className="h-3.5 w-3.5" /> Satellite
        </button>
      </div>
      <button type="button" onClick={recenter} aria-label="Recenter"
        className="absolute bottom-6 right-2 z-[500] grid h-10 w-10 place-items-center rounded-full bg-background shadow-md">
        <Crosshair className="h-5 w-5" />
      </button>
      {tileError && layer === "satellite" && (
        <p className="absolute left-2 top-14 z-[500] rounded-lg bg-background/95 px-2 py-1 text-[11px] text-muted-foreground shadow">
          Satellite imagery isn't available at this zoom. Zoom out a little or use Standard.
        </p>
      )}
    </div>
  );
}

function currentShape(d: Draft, m: MapMode): LatLng[] | null {
  if (m.kind === "boundary") return d.boundary ?? [];
  if (m.kind === "lot") return d.lots?.find((l) => l.id === m.lotId)?.polygon ?? null;
  if (m.kind === "row") return d.rows?.find((r) => r.id === m.rowId)?.line ?? null;
  return null;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

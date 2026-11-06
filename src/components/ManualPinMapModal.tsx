// Browser-only Leaflet imports: load this module lazily from an authorized tap.
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-rotate";
import { X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lotCenter, manualPinLocation, pinZoneAt, type ManualPin, type MapPoint } from "@/lib/manual-pin";

export default function ManualPinMapModal({ companyCode, approximate, initial, onSave, onClose }: {
  companyCode?: string; approximate: MapPoint | null; initial: ManualPin | null;
  onSave: (pin: ManualPin) => void; onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState<MapPoint | null>(initial);
  const [spot, setSpot] = useState(initial?.location.match(/ (\d+)$/)?.[1] ?? "");
  const zone = point ? pinZoneAt(companyCode, point) : null;
  const location = point ? manualPinLocation(companyCode, point, spot) : null;
  useEffect(() => {
    if (!host.current) return;
    const center = initial ?? approximate ?? lotCenter(companyCode);
    const map = L.map(host.current, { center: center ? [center.latitude, center.longitude] : [0, 0],
      zoom: center ? 19 : 2, maxZoom: 22, zoomControl: false, attributionControl: true,
      rotate: true, touchRotate: true, bearing: 0,
      rotateControl: { closeOnZeroBearing: false, position: "bottomright" },
    } as L.MapOptions);
    map.attributionControl.setPrefix(false);
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxNativeZoom: 18, maxZoom: 22, attribution: "Imagery © Esri, Maxar",
    }).addTo(map);
    let marker: L.Marker | null = null;
    const select = (latlng: L.LatLng, resetSpot: boolean) => {
      const next = { latitude: latlng.lat, longitude: latlng.lng };
      setPoint(next);
      if (resetSpot) setSpot("");
      if (marker) marker.setLatLng(latlng);
      else {
        marker = L.marker(latlng, { draggable: true, icon: L.divIcon({ className: "manual-car-pin", html: '<span></span>', iconSize: [28, 38], iconAnchor: [14, 38] }) }).addTo(map);
        marker.on("dragend", () => { if (marker) select(marker.getLatLng(), true); });
      }
    };
    map.on("click", (event: L.LeafletMouseEvent) => select(event.latlng, true));
    if (initial) select(L.latLng(initial.latitude, initial.longitude), false);
    return () => { map.remove(); };
  }, [companyCode, approximate, initial]);
  return <div role="dialog" aria-modal="true" aria-label="Manual car pin" className="fixed inset-0 z-[70] flex flex-col bg-background">
    <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 safe-top">
      <p className="font-semibold">Car location</p>
      <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close manual map"><X className="h-5 w-5" /></Button>
    </header>
    <div ref={host} className="min-h-0 flex-1" />
    <footer className="space-y-3 border-t border-border px-4 py-3 safe-bottom">
      {zone && <label className="block text-sm font-medium">{zone.location} · Which spot #? (1–{zone.maxSpot})
        <input autoFocus aria-label="Spot number" inputMode="numeric" type="text" value={spot} onChange={(e) => setSpot(e.target.value.replace(/\D/g, ""))} className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-3 text-base" />
      </label>}
      <Button type="button" className="w-full gap-2" disabled={!point || !location} onClick={() => {
        if (point && location) onSave({ ...point, location, pinned_at: new Date().toISOString() });
      }}><Save className="h-4 w-4" />Save</Button>
    </footer>
  </div>;
}
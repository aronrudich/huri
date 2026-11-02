// Private satellite pin-drop viewer — only ever rendered for Aron's accounts.
// Leaflet touches browser APIs at import time, so this module is always loaded
// through React.lazy after a tap; never import it statically.
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { X, Maximize2 } from "lucide-react";
import { format } from "date-fns";

export type PinnedCar = {
  id: string;
  ro_number: string | null;
  car_model: string | null;
  lot_position: string | null;
  latitude: number;
  longitude: number;
  accuracy_ft: number | null;
  pinned_at: string | null;
};

const TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ATTRIBUTION = "Imagery © Esri, Maxar";
/** Parking-stall level: individual spaces and cars are clearly visible. */
const STALL_ZOOM = 19;

function pinIcon(color: string, label: string) {
  return L.divIcon({
    className: "",
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))">
        <svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="${color}" stroke="#fff" stroke-width="2"/>
          <circle cx="15" cy="15" r="6.5" fill="#fff"/>
        </svg>
        <span style="margin-top:2px;background:rgba(0,0,0,.75);color:#fff;font-size:11px;font-weight:700;padding:1px 6px;border-radius:8px;white-space:nowrap">${label}</span>
      </div>`,
  });
}

export default function SatellitePinMapModal({
  focus,
  others,
  onClose,
}: {
  focus: PinnedCar;
  others: PinnedCar[];
  onClose: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [selected, setSelected] = useState<PinnedCar>(focus);

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;
    setSelected(focus);
    const map = L.map(hostRef.current, {
      center: [focus.latitude, focus.longitude],
      zoom: STALL_ZOOM,
      maxZoom: 21,
      zoomControl: false,
      attributionControl: true,
    });
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 21 }).addTo(map);
    mapRef.current = map;

    const all = [focus, ...others.filter((c) => c.id !== focus.id)];
    all.forEach((car) => {
      const isFocus = car.id === focus.id;
      const marker = L.marker([car.latitude, car.longitude], {
        icon: pinIcon(isFocus ? "#dc2626" : "#2563eb", car.ro_number ? `#${car.ro_number}` : "—"),
      }).addTo(map);
      marker.on("click", () => {
        setSelected(car);
        map.flyTo([car.latitude, car.longitude], STALL_ZOOM, { duration: 0.6 });
      });
      if (car.accuracy_ft) {
        L.circle([car.latitude, car.longitude], {
          radius: car.accuracy_ft / 3.28084,
          color: isFocus ? "#dc2626" : "#2563eb",
          weight: 1.5,
          fillOpacity: 0.12,
        }).addTo(map);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Remove finished/canceled requests while the queue map remains open.
  }, [focus, others]);

  const fitAll = () => {
    const map = mapRef.current;
    if (!map) return;
    const all = [focus, ...others.filter((c) => c.id !== focus.id)];
    if (all.length <= 1) {
      map.flyTo([focus.latitude, focus.longitude], STALL_ZOOM, { duration: 0.6 });
      return;
    }
    map.flyToBounds(
      L.latLngBounds(all.map((c) => [c.latitude, c.longitude] as [number, number])),
      { padding: [60, 60], duration: 0.6 },
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 safe-top">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">Satellite pin test</p>
          <p className="text-xs text-muted-foreground">
            Red = selected car · Blue = other pinned cars
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close satellite map"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted active:bg-accent"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={hostRef} className="absolute inset-0" />
        <button
          type="button"
          onClick={fitAll}
          className="absolute left-3 top-3 z-[500] flex items-center gap-1.5 rounded-xl bg-background/95 px-3 py-2 text-xs font-semibold shadow-lg active:bg-accent"
        >
          <Maximize2 className="h-4 w-4" /> Fit All Pins
        </button>
      </div>

      <div className="border-t border-border bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-md rounded-2xl bg-surface px-4 py-3">
          <p className="text-base font-semibold">
            {selected.ro_number ? `RO #${selected.ro_number}` : "No RO #"}
            {selected.car_model ? <span className="ml-2 text-sm font-normal text-muted-foreground">{selected.car_model}</span> : null}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Logged spot: <span className="font-semibold text-foreground">{selected.lot_position ?? "Unknown"}</span>
            {selected.accuracy_ft != null && <> · Accuracy ±{selected.accuracy_ft} ft</>}
          </p>
          {selected.pinned_at && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Pinned {format(new Date(selected.pinned_at), "MMM d, h:mm a")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Real photo map of the SV lot. The aerial shot is cropped exactly to the
// painted grid, so 49 rows x 3 columns of stall buttons line up on top of it.
// Filled stalls are red, stalls whose car is on the active pickup list are
// blue, open stalls show the pavement, and an optional highlighted stall is
// blue (used when locating a pickup's car).

import { useEffect, useRef } from "react";
import lotPhoto from "@/assets/sv-lot.jpg.asset.json";
import { MAX_SPOT, MIN_SPOT } from "@/lib/lot";

type MapCar = {
  id: string;
  ro_number: string | null;
  car_model: string | null;
  lot_position: string;
  notes: string | null;
};

type LotMapProps = {
  /** Spot labels to keep highlighted by the current search, e.g. ["SV 1"]. */
  spots: string[];
  /** Cars keyed by uppercase spot label. */
  carsBySpot: Record<string, MapCar>;
  /** Spot label to highlight in blue, if any. */
  highlightSpot?: string | null;
  /** Spot labels whose car is currently on the active pickup list. */
  pickupSpots?: Set<string>;
  /** Called when an occupied stall is tapped. */
  onSelect?: (car: MapCar) => void;
  /** Called when an empty stall is tapped. */
  onSelectEmpty?: (spot: string) => void;
  /** Read-only zoomed-out snapshot: fits its container, nothing tappable. */
  staticView?: boolean;
};

const ROWS = Math.ceil((MAX_SPOT - MIN_SPOT + 1) / 3); // 49
const COLS = 3;
// Photo is cropped to the painted grid: 825 x 4611 px.
const ASPECT = 825 / 4611;

export function LotMap({
  spots,
  carsBySpot,
  highlightSpot,
  pickupSpots,
  onSelect,
  onSelectEmpty,
  staticView,
}: LotMapProps) {
  const highlight = highlightSpot?.toUpperCase() ?? null;
  const visible = new Set(spots.map((s) => s.toUpperCase()));
  const dimOthers = spots.length > 0 && spots.length < MAX_SPOT;
  const highlightRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!staticView && highlight) highlightRef.current?.scrollIntoView({ block: "center" });
  }, [highlight, staticView]);

  const cells = [];
  for (let n = MIN_SPOT; n <= MAX_SPOT; n++) {
    const spot = `SV ${n}`;
    const row = Math.floor((n - 1) / COLS);
    const col = (n - 1) % COLS;
    const car = carsBySpot[spot];
    const isHighlight = highlight === spot;
    const isPickup = !isHighlight && !!pickupSpots?.has(spot);
    const dimmed = dimOthers && !visible.has(spot) && !isHighlight;
    const tone = isHighlight || isPickup
      ? "bg-primary/85 text-primary-foreground ring-2 ring-primary"
      : car
        ? "bg-destructive/80 text-destructive-foreground"
        : "bg-transparent text-foreground";
    cells.push(
      <button
        key={spot}
        ref={isHighlight ? highlightRef : undefined}
        type="button"
        disabled={staticView}
        onClick={() => (car ? onSelect?.(car) : onSelectEmpty?.(spot))}
        aria-label={car ? `Spot ${n}, occupied` : `Spot ${n}, open`}
        style={{
          position: "absolute",
          top: `${(row / ROWS) * 100}%`,
          left: `${(col / COLS) * 100}%`,
          width: `${100 / COLS}%`,
          height: `${100 / ROWS}%`,
        }}
        className={`flex items-center justify-center border border-white/70 font-extrabold tabular-nums ${
          staticView ? "text-[7px] leading-none" : "text-[13px]"
        } ${tone} ${dimmed ? "opacity-30" : ""} ${staticView ? "pointer-events-none" : "active:brightness-90"}`}
      >
        <span className={isHighlight || isPickup || car ? "" : "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"}>
          {n}
        </span>
      </button>,
    );
  }

  if (staticView) {
    return (
      <div className="flex h-full w-full items-center justify-center overflow-hidden">
        <div
          className="relative h-full overflow-hidden rounded-xl bg-muted"
          style={{ aspectRatio: `${ASPECT}`, maxWidth: "100%" }}
        >
          <img
            src={lotPhoto.url}
            alt="Aerial view of the SV lot"
            className="absolute inset-0 h-full w-full object-cover select-none"
            draggable={false}
          />
          {cells}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm sm:max-w-md">
      <div
        className="relative w-full overflow-hidden rounded-2xl bg-muted"
        style={{ aspectRatio: `${ASPECT}` }}
      >
        <img
          src={lotPhoto.url}
          alt="Aerial view of the SV lot"
          className="absolute inset-0 h-full w-full object-cover select-none"
          draggable={false}
        />
        {cells}
      </div>
    </div>
  );
}

// Map of the SV lot (spots 1..147, 3-deep rows).
//
// Mobile keeps the real aerial photo: the shot is cropped exactly to the painted
// grid, so 49 rows x 3 columns of stall buttons line up on top of it.
// Desktop (md+) lays the same lot out horizontally — 49 row-groups across, 3
// deep — so every spot fits on screen without any vertical scrolling.
//
// Colors: red = filled, blue = car is on the active pickup list (or the located
// pickup), checkered = staged (ready, waiting on the customer), clear = open.

import { useEffect, useRef } from "react";
import lotPhoto from "@/assets/sv-lot.jpg.asset.json";
import { MAX_SPOT, MIN_SPOT } from "@/lib/lot";

type MapCar = {
  id: string;
  ro_number: string | null;
  car_model: string | null;
  lot_position: string;
  notes: string | null;
  is_staged?: boolean | null;
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
  /** Spot labels whose car has been staged for the customer. */
  stagedSpots?: Set<string>;
  /** Called when an occupied stall is tapped. */
  onSelect?: (car: MapCar) => void;
  /** Called when an empty stall is tapped. */
  onSelectEmpty?: (spot: string) => void;
  /** Read-only zoomed-out snapshot: fits its container, nothing tappable. */
  staticView?: boolean;
};

const COLS = 3;
const ROWS = Math.ceil((MAX_SPOT - MIN_SPOT + 1) / COLS); // 49
// Photo is cropped to the painted grid: 825 x 4611 px.
const ASPECT = 825 / 4611;

// Softened checker so the stall number stays readable on top of it.
const CHECKER = {
  backgroundImage:
    "repeating-conic-gradient(var(--muted-foreground) 0% 25%, var(--background) 0% 50%)",
  backgroundSize: "8px 8px",
  opacity: 0.85,
} as const;

export function LotMap({
  spots,
  carsBySpot,
  highlightSpot,
  pickupSpots,
  stagedSpots,
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

  /** Shared per-stall state + classes for every layout. */
  const stall = (n: number) => {
    const spot = `SV ${n}`;
    const car = carsBySpot[spot];
    const isHighlight = highlight === spot;
    const isPickup = !isHighlight && !!pickupSpots?.has(spot);
    // Staged only matters while the car is still sitting there and isn't
    // already being picked up — a new car or a pickup takes over the color.
    const isStaged = !isHighlight && !isPickup && !!car && (car.is_staged || !!stagedSpots?.has(spot));
    const dimmed = dimOthers && !visible.has(spot) && !isHighlight;
    const tone = isHighlight || isPickup
      ? "bg-primary/85 text-primary-foreground ring-2 ring-primary"
      : isStaged
        ? "text-foreground"
        : car
          ? "bg-destructive/80 text-destructive-foreground"
          : "bg-transparent text-foreground";
    const plain = !isHighlight && !isPickup && !isStaged && !car;
    return { spot, car, isHighlight, isStaged, tone, dimmed, plain };
  };

  const cellProps = (n: number) => {
    const s = stall(n);
    return {
      key: s.spot,
      ref: s.isHighlight ? highlightRef : undefined,
      type: "button" as const,
      disabled: staticView,
      onClick: () => (s.car ? onSelect?.(s.car) : onSelectEmpty?.(s.spot)),
      "aria-label": s.car
        ? `Spot ${n}, ${s.isStaged ? "staged" : "occupied"}`
        : `Spot ${n}, open`,
      style: s.isStaged ? CHECKER : undefined,
      s,
    };
  };

  /** Absolutely positioned stalls layered over the aerial photo (mobile). */
  const photoCells = [];
  for (let n = MIN_SPOT; n <= MAX_SPOT; n++) {
    const { s, key, ...rest } = cellProps(n);
    const row = Math.floor((n - 1) / COLS);
    const col = (n - 1) % COLS;
    photoCells.push(
      <button
        key={key}
        {...rest}
        style={{
          ...(rest.style ?? {}),
          position: "absolute",
          top: `${(row / ROWS) * 100}%`,
          left: `${(col / COLS) * 100}%`,
          width: `${100 / COLS}%`,
          height: `${100 / ROWS}%`,
        }}
        className={`flex items-center justify-center border border-white/70 font-extrabold tabular-nums ${
          staticView ? "text-[7px] leading-none" : "text-[13px]"
        } ${s.tone} ${s.dimmed ? "opacity-30" : ""} ${staticView ? "pointer-events-none" : "active:brightness-90"}`}
      >
        <span
          className={
            s.isStaged
              ? "rounded bg-background/90 px-1 text-foreground"
              : s.plain
                ? "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                : ""
          }
        >
          {n}
        </span>
      </button>,
    );
  }

  /**
   * Plain CSS-grid stalls, used for the horizontal desktop map and snapshots.
   * `mirror` places spot 1 in the BOTTOM row of its column, so numbers run
   * bottom-to-top, left-to-right like the real lot.
   */
  const gridCells = (size: "sm" | "xs", mirror: false | "h" | "v" = false) => {
    const out = [];
    for (let n = MIN_SPOT; n <= MAX_SPOT; n++) {
      const { s, key, ...rest } = cellProps(n);
      const place =
        mirror === "h"
          ? {
              gridColumn: Math.floor((n - 1) / COLS) + 1,
              gridRow: COLS - ((n - 1) % COLS),
            }
          : mirror === "v"
            ? {
                gridColumn: ((n - 1) % COLS) + 1,
                gridRow: ROWS - Math.floor((n - 1) / COLS),
              }
            : {};
      out.push(
        <button
          key={key}
          {...rest}
          style={{ ...(rest.style ?? {}), ...place }}
          className={`flex h-full w-full items-center justify-center border border-border font-extrabold tabular-nums ${
            size === "xs" ? "text-[7px] leading-none" : "text-[10px]"
          } ${s.tone} ${s.dimmed ? "opacity-30" : ""} ${staticView ? "pointer-events-none" : "hover:brightness-95"}`}
        >
          <span className={s.isStaged ? "rounded bg-background/90 px-0.5 text-foreground" : ""}>{n}</span>
        </button>,
      );
    }
    return out;
  };



  // Read-only snapshot: pure grid that always fits its container, no scrolling.
  if (staticView) {
    return (
      <div className="h-full w-full overflow-hidden">
        <div
          className="grid h-full w-full md:hidden"
          style={{
            gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
          }}
        >
          {gridCells("xs", "v")}
        </div>
        <div
          className="hidden h-full w-full md:grid"
          style={{
            gridTemplateRows: `repeat(${COLS}, minmax(0, 1fr))`,
            gridTemplateColumns: `repeat(${ROWS}, minmax(0, 1fr))`,
          }}
        >
          {gridCells("xs", "h")}
        </div>

      </div>
    );
  }

  return (
    <>
      {/* Mobile: real aerial photo, scrolls vertically with the page. */}
      <div className="mx-auto w-full max-w-sm sm:max-w-md md:hidden">
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
          {photoCells}
        </div>
      </div>

      {/* Desktop: whole lot laid out horizontally, 49 groups of 3 across. */}
      <div className="hidden md:block">
        <div
          className="grid w-full overflow-hidden rounded-2xl bg-muted"
          style={{
            gridTemplateRows: `repeat(${COLS}, 3rem)`,
            gridTemplateColumns: `repeat(${ROWS}, minmax(0, 1fr))`,
          }}
        >
          {gridCells("sm", "h")}
        </div>

      </div>
    </>
  );
}

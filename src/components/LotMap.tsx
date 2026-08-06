// Color-coded stall map for the SV lot (3 stalls per row, 1..147).
// Filled stalls are red, open stalls are uncolored, and an optional
// highlighted stall is blue (used when locating a pickup's car).

type MapCar = {
  id: string;
  ro_number: string | null;
  car_model: string | null;
  lot_position: string;
  notes: string | null;
};

type LotMapProps = {
  /** Ordered spot labels to render, e.g. ["SV 1", "SV 2", ...]. */
  spots: string[];
  /** Cars keyed by uppercase spot label. */
  carsBySpot: Record<string, MapCar>;
  /** Spot label to highlight in blue, if any. */
  highlightSpot?: string | null;
  /** Called when an occupied stall is tapped. */
  onSelect?: (car: MapCar) => void;
};

export function LotMap({ spots, carsBySpot, highlightSpot, onSelect }: LotMapProps) {
  const highlight = highlightSpot?.toUpperCase() ?? null;

  return (
    <div className="mx-auto w-full max-w-sm sm:max-w-md">
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
        {spots.map((spot) => {
          const car = carsBySpot[spot.toUpperCase()];
          const isHighlight = highlight === spot.toUpperCase();
          const label = spot.replace("SV ", "");
          const tone = isHighlight
            ? "bg-primary text-primary-foreground border-primary"
            : car
              ? "bg-destructive text-destructive-foreground border-destructive"
              : "bg-background text-foreground border-border";
          return (
            <button
              key={spot}
              type="button"
              disabled={!car}
              onClick={() => car && onSelect?.(car)}
              aria-label={car ? `Spot ${label}, occupied` : `Spot ${label}, open`}
              className={`flex aspect-[2.6/1] items-center justify-center rounded-md border text-sm font-bold tabular-nums ${tone} ${
                car ? "active:scale-[0.97]" : "cursor-default"
              }`}
            >
              {label}
            </button>
          );
        })}
        {spots.length === 0 && (
          <p className="col-span-3 py-6 text-center text-sm text-muted-foreground">No matches</p>
        )}
      </div>
    </div>
  );
}

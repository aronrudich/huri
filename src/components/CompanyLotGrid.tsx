import type { LocationRule } from "@/lib/company-locations";
import { Button } from "@/components/ui/button";

type Car = { id: string; ro_number: string | null; car_model: string | null; lot_position: string; notes: string | null };
export function CompanyLotGrid({ rules, cars, highlight, pickupSpots, onSelect, onSelectEmpty }: {
  rules: LocationRule[]; cars: Car[]; highlight?: string | null; pickupSpots?: Set<string>;
  onSelect?: (car: Car) => void; onSelectEmpty?: (spot: string) => void;
}) {
  const lots = [...new Set(rules.map((r) => r.lot_name))];
  return <div className="space-y-5">{lots.map((lot) => <section key={lot}>
    <h2 className="mb-2 text-sm font-semibold">{lot}</h2>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">{rules.filter((r) => r.lot_name === lot).map((rule) => {
      const occupants = cars.filter((c) => c.lot_position.toUpperCase() === rule.label);
      const car = occupants[0];
      const selected = highlight === rule.label || pickupSpots?.has(rule.label);
      return <Button key={rule.label} aria-label={`${rule.label}, ${car ? "occupied" : "open"}`} onClick={() => car ? onSelect?.(car) : onSelectEmpty?.(rule.label)} className={`min-h-20 flex-col border border-border ${selected ? "bg-primary text-primary-foreground" : car ? "bg-destructive text-destructive-foreground" : "bg-muted text-foreground"}`}>
        <span className="max-w-full break-words">{rule.label}</span>
        {car && <span className="max-w-full truncate text-xs">{occupants.length > 1 ? `${occupants.length} cars` : car.ro_number}</span>}
      </Button>;
    })}</div>
  </section>)}</div>;
}
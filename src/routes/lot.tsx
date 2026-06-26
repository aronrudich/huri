import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BottomBar, HuriLogo, TopActions } from "@/components/BottomBar";
import { MAX_SPOT, MIN_SPOT } from "@/lib/lot";

export const Route = createFileRoute("/lot")({
  head: () => ({ meta: [{ title: "Lot · Huri" }] }),
  component: LotPage,
});

type ParkedCar = {
  id: string; tag_number: string | null; ro_number: string | null;
  car_model: string | null; lot_position: string; notes: string | null;
};

function LotPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [cars, setCars] = useState<ParkedCar[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = () => supabase.from("parked_cars").select("*")
      .then(({ data }) => setCars((data as ParkedCar[]) ?? []));
    load();
    const chan = supabase.channel("lot-all-spots")
      .on("postgres_changes", { event: "*", schema: "public", table: "parked_cars" }, load)
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [user]);

  const byPos = useMemo(() => {
    const m: Record<number, ParkedCar> = {};
    cars.forEach((c) => {
      if (c.lot_position === "UNKNOWN") return;
      const n = parseInt(c.lot_position, 10);
      if (!Number.isNaN(n) && n >= 1) m[n] = c;
    });
    return m;
  }, [cars]);

  const offLot = useMemo(
    () =>
      cars
        .filter((c) => c.lot_position === "0")
        .sort((a, b) => (a.ro_number ?? "").localeCompare(b.ro_number ?? "")),
    [cars],
  );

  const rows = useMemo(() => {
    const list: { spot: number; car?: ParkedCar }[] = [];
    for (let s = MIN_SPOT; s <= MAX_SPOT; s++) list.push({ spot: s, car: byPos[s] });
    const n = q.trim().toLowerCase();
    if (!n) return list;
    return list.filter(({ spot, car }) =>
      String(spot).includes(n) ||
      car?.ro_number?.toLowerCase().includes(n) ||
      car?.car_model?.toLowerCase().includes(n),
    );
  }, [byPos, q]);

  const filteredOffLot = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return offLot;
    return offLot.filter(
      (c) => c.ro_number?.toLowerCase().includes(n) || c.car_model?.toLowerCase().includes(n),
    );
  }, [offLot, q]);
    const n = q.trim().toLowerCase();
    if (!n) return list;
    return list.filter(({ spot, car }) =>
      String(spot).includes(n) ||
      car?.ro_number?.toLowerCase().includes(n) ||
      car?.car_model?.toLowerCase().includes(n),
    );
  }, [byPos, q]);

  const filled = Object.keys(byPos).length;

  return (
    <div className="min-h-screen bg-surface pb-32 safe-top">
      <header className="sticky top-0 z-10 bg-surface/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="mb-3 flex items-center gap-2">
          <HuriLogo />
          <div className="flex-1" />
          <TopActions />
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by spot, RO #, or model"
            className="w-full rounded-xl bg-muted py-2.5 pl-9 pr-3 text-base outline-none placeholder:text-muted-foreground"
          />
        </div>
        <p className="px-1 pt-1 text-[11px] text-muted-foreground">
          {filled} of {MAX_SPOT} spots occupied
        </p>
      </header>

      <ul className="mx-3 overflow-hidden rounded-2xl bg-background">
        {rows.map(({ spot, car }) => (
          <li
            key={spot}
            className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
          >
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-bold ${
              car ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}>
              {spot}
            </div>
            <div className="min-w-0 flex-1">
              {car ? (
                <>
                  <p className="truncate text-sm font-semibold">
                    {car.ro_number ? `RO #${car.ro_number}` : "No RO #"}
                    {car.car_model && <span className="text-muted-foreground"> · {car.car_model}</span>}
                  </p>
                  {car.notes && (
                    <p className="truncate text-xs text-warning">Note: {car.notes}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Empty</p>
              )}
            </div>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">No matches</li>
        )}
      </ul>

      <BottomBar active="lot" />
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BottomBar, HuriLogo, TopActions } from "@/components/BottomBar";
import { spotsForLot, lotOf, type LotId } from "@/lib/lot";

export const Route = createFileRoute("/lot")({
  head: () => ({ meta: [{ title: "Lot · Huri" }] }),
  component: LotPage,
});

type ParkedCar = {
  id: string; tag_number: string | null; ro_number: string | null;
  car_model: string | null; lot_position: string; notes: string | null;
};

const TABS: { id: LotId; label: string }[] = [
  { id: "lot1", label: "Lot 1" },
  { id: "lotC", label: "Lot C" },
  { id: "lotT", label: "Lot T" },
];

function LotPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [cars, setCars] = useState<ParkedCar[]>([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<LotId>("lot1");

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
    const m: Record<string, ParkedCar> = {};
    cars.forEach((c) => {
      if (!c.lot_position || c.lot_position === "UNKNOWN") return;
      if (c.lot_position === "T" || c.lot_position === "C") return;
      m[c.lot_position.toUpperCase()] = c;
    });
    return m;
  }, [cars]);

  const carsInLotC = useMemo(
    () => cars.filter((c) => c.lot_position?.toUpperCase() === "C"),
    [cars],
  );
  const carsInLotT = useMemo(
    () => cars.filter((c) => c.lot_position?.toUpperCase() === "T"),
    [cars],
  );
  const carsUnknown = useMemo(
    () => cars.filter((c) => !c.lot_position || c.lot_position.toUpperCase() === "UNKNOWN"),
    [cars],
  );

  const spots = useMemo(() => spotsForLot(tab), [tab]);

  const filteredNumbered = useMemo(() => {
    if (tab !== "lot1") return [];
    const list = spots.map((s) => ({ spot: s, car: byPos[s] }));
    const n = q.trim().toLowerCase();
    if (!n) return list;
    return list.filter(({ spot, car }) =>
      spot.toLowerCase().includes(n) ||
      car?.ro_number?.toLowerCase().includes(n) ||
      car?.car_model?.toLowerCase().includes(n),
    );
  }, [spots, byPos, q, tab]);

  const filteredFreeform = useMemo(() => {
    const source = tab === "lotC" ? carsInLotC : tab === "lotT" ? carsInLotT : [];
    const n = q.trim().toLowerCase();
    if (!n) return source;
    return source.filter((c) =>
      c.ro_number?.toLowerCase().includes(n) ||
      c.car_model?.toLowerCase().includes(n),
    );
  }, [tab, carsInLotC, carsInLotT, q]);

  // Cars with an UNKNOWN location that match the search — surfaced from every tab.
  const filteredUnknown = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return carsUnknown.filter((c) =>
      c.ro_number?.toLowerCase().includes(n) ||
      c.car_model?.toLowerCase().includes(n),
    );
  }, [carsUnknown, q]);

  // Cross-lot search: auto-switch tab if the query matches a car in another lot.
  useEffect(() => {
    const n = q.trim().toLowerCase();
    if (!n) return;
    const matches = (c: ParkedCar) =>
      c.lot_position?.toLowerCase().includes(n) ||
      c.ro_number?.toLowerCase().includes(n) ||
      c.car_model?.toLowerCase().includes(n);
    const inCurrent = cars.some((c) => matches(c) && lotOf(c.lot_position) === tab);
    if (inCurrent) return;
    for (const t of TABS.map((x) => x.id)) {
      if (t === tab) continue;
      if (cars.some((c) => matches(c) && lotOf(c.lot_position) === t)) {
        setTab(t);
        return;
      }
    }
  }, [q, cars, tab]);

  const filled = tab === "lot1" ? spots.filter((s) => byPos[s]).length : 0;

  return (
    <div className="min-h-screen bg-surface pb-32 safe-top">
      <header className="sticky top-0 z-10 bg-surface/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="mb-3 flex items-center gap-2">
          <HuriLogo />
          <div className="flex-1" />
          <TopActions />
        </div>

        <div className="mb-3 flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold ${
                tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
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
          {tab === "lot1" && `${filled} of ${spots.length} spots occupied`}
          {tab === "lotC" && `${carsInLotC.length} car${carsInLotC.length === 1 ? "" : "s"} in Lot C`}
          {tab === "lotT" && `${carsInLotT.length} car${carsInLotT.length === 1 ? "" : "s"} in Lot T`}
        </p>
      </header>

      {tab === "lot1" ? (
        <ul className="mx-3 overflow-hidden rounded-2xl bg-background">
          {filteredNumbered.map(({ spot, car }) => {
            const inner = (
              <>
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
              </>
            );
            return (
              <li key={spot} className="border-b border-border last:border-b-0">
                {car ? (
                  <Link
                    to="/park"
                    search={{ id: car.id }}
                    className="flex items-center gap-3 px-4 py-3 active:bg-accent"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3">{inner}</div>
                )}
              </li>
            );
          })}
          {filteredNumbered.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">No matches</li>
          )}
        </ul>
      ) : (
        <ul className="mx-3 overflow-hidden rounded-2xl bg-background">
          {filteredFreeform.map((car) => (
            <li key={car.id} className="border-b border-border last:border-b-0">
              <Link
                to="/park"
                search={{ id: car.id }}
                className="flex items-center gap-3 px-4 py-3 active:bg-accent"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {car.lot_position.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {car.ro_number ? `RO #${car.ro_number}` : "No RO #"}
                    {car.car_model && <span className="text-muted-foreground"> · {car.car_model}</span>}
                  </p>
                  {car.notes && (
                    <p className="truncate text-xs text-warning">Note: {car.notes}</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
          {filteredFreeform.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              {tab === "lotC" ? "No cars in Lot C." : "No cars in Lot T."}
            </li>
          )}
        </ul>
      )}

      {filteredUnknown.length > 0 && (
        <>
          <p className="mx-4 mt-4 mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Location unknown ({filteredUnknown.length})
          </p>
          <ul className="mx-3 overflow-hidden rounded-2xl bg-background">
            {filteredUnknown.map((car) => (
              <li key={car.id} className="border-b border-border last:border-b-0">
                <Link to="/park" search={{ id: car.id }} className="flex items-center gap-3 px-4 py-3 active:bg-accent">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                    ?
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {car.ro_number ? `RO #${car.ro_number}` : "No RO #"}
                      {car.car_model && <span className="text-muted-foreground"> · {car.car_model}</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">Location unknown — not in any lot</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}


      <BottomBar active="lot" />
    </div>
  );
}

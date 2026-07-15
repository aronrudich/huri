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

function LotPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [cars, setCars] = useState<ParkedCar[]>([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<LotId>("lot2");

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
      m[c.lot_position.toUpperCase()] = c;
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

  const spots = useMemo(() => spotsForLot(tab), [tab]);

  const rows = useMemo(() => {
    const list = spots.map((s) => ({ spot: s, car: byPos[s] }));
    const n = q.trim().toLowerCase();
    if (!n) return list;
    return list.filter(({ spot, car }) =>
      spot.toLowerCase().includes(n) ||
      car?.ro_number?.toLowerCase().includes(n) ||
      car?.car_model?.toLowerCase().includes(n),
    );
  }, [spots, byPos, q]);

  // Cross-lot search: if the query matches a car in the other lot but not the current one, auto-switch tabs.
  useEffect(() => {
    const n = q.trim().toLowerCase();
    if (!n) return;
    const matches = (c: ParkedCar) =>
      c.lot_position?.toLowerCase().includes(n) ||
      c.ro_number?.toLowerCase().includes(n) ||
      c.car_model?.toLowerCase().includes(n);
    const inCurrent = cars.some((c) => matches(c) && lotOf(c.lot_position) === tab);
    if (inCurrent) return;
    const other: LotId = tab === "lot1" ? "lot2" : "lot1";
    const inOther = cars.some((c) => matches(c) && lotOf(c.lot_position) === other);
    if (inOther) setTab(other);
  }, [q, cars, tab]);

  const filteredOffLot = useMemo(() => {
    if (tab !== "lot2") return [];
    const n = q.trim().toLowerCase();
    if (!n) return offLot;
    return offLot.filter(
      (c) => c.ro_number?.toLowerCase().includes(n) || c.car_model?.toLowerCase().includes(n),
    );
  }, [offLot, q, tab]);

  const filled = spots.filter((s) => byPos[s]).length;

  return (
    <div className="min-h-screen bg-surface pb-32 safe-top">
      <header className="sticky top-0 z-10 bg-surface/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="mb-3 flex items-center gap-2">
          <HuriLogo />
          <div className="flex-1" />
          <TopActions />
        </div>

        <div className="mb-3 flex gap-2">
          {(["lot1", "lot2"] as LotId[]).map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold ${
                tab === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {id === "lot1" ? "Lot 1" : "Lot 2"}
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
          {filled} of {spots.length} spots occupied
          {tab === "lot2" && ` · ${offLot.length} off the lot (spot 0)`}
        </p>
      </header>

      {filteredOffLot.length > 0 && (
        <>
          <h2 className="mx-4 mb-1 mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Off the lot (spot 0)
          </h2>
          <ul className="mx-3 mb-3 overflow-hidden rounded-2xl bg-background">
            {filteredOffLot.map((car) => (
              <li key={car.id}>
                <Link
                  to="/park"
                  search={{ ro: car.ro_number ?? undefined }}
                  className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 active:bg-accent"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-warning/15 text-xs font-bold text-warning">
                    0
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
          </ul>
        </>
      )}

      <ul className="mx-3 overflow-hidden rounded-2xl bg-background">
        {rows.map(({ spot, car }) => {
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
                  search={{ ro: car.ro_number ?? undefined }}
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
        {rows.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">No matches</li>
        )}
      </ul>

      <BottomBar active="lot" />
    </div>
  );
}

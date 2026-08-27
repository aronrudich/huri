import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeGeneration, handleChannelStatus } from "@/lib/realtime-recovery";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { BottomBar, HuriLogo, TopActions } from "@/components/BottomBar";
import { spotsForLot, lotOf, normalizeSpot, spotBadge, type LotId } from "@/lib/lot";
import { PeopleSearchResults } from "@/components/PeopleSearchResults";
import { LotMap } from "@/components/LotMap";
import { lotActivePickupsQuery, parkedCarsQuery } from "@/lib/queries";


export const Route = createFileRoute("/lot")({
  head: () => ({ meta: [{ title: "Lot · Huri" }] }),
  component: LotPage,
});

type ParkedCar = {
  id: string; tag_number: string | null; ro_number: string | null;
  car_model: string | null; lot_position: string; notes: string | null;
  is_staged?: boolean | null;
};

type ActivePickup = {
  ro_number: string | null; lot_position: string | null;
  kind: string | null; status: string; is_staged?: boolean | null;
};

const TABS: { id: LotId; label: string }[] = [
  { id: "sv", label: "SV" },
  { id: "cp", label: "CP" },
  { id: "bl", label: "BL" },
];

function LotPage() {
  // Bumped when the app returns from the background so channels rebuild.
  const realtimeGen = useRealtimeGeneration();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<LotId>("sv");
  const [pickupSpots, setPickupSpots] = useState<Set<string>>(new Set());
  const [stagedSpots, setStagedSpots] = useState<Set<string>>(new Set());
  // Empty SV stall tapped on the map (spot label), shown in a details modal.
  const [emptySpot, setEmptySpot] = useState<string | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);

  // Cars and open submissions come from the shared query cache, so switching
  // back to this tab paints the previous map instantly.
  const { data: carsData = [] } = useQuery({ ...parkedCarsQuery(), enabled: !!user });
  const cars = carsData as ParkedCar[];
  const { data: activePickupsData = [] } = useQuery({ ...lotActivePickupsQuery(), enabled: !!user });
  const activePickups = activePickupsData as ActivePickup[];

  useEffect(() => {
    if (!user) return;
    const chan = supabase.channel("lot-all-spots")
      .on("postgres_changes", { event: "*", schema: "public", table: "parked_cars" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["parked-cars"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pickup_requests" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["lot-active-pickups"] });
      })
      .subscribe(handleChannelStatus);
    return () => { supabase.removeChannel(chan); };
  }, [user, queryClient, realtimeGen]);


  const byPos = useMemo(() => {
    const m: Record<string, ParkedCar> = {};
    cars.forEach((c) => {
      if (!c.lot_position || c.lot_position === "UNKNOWN") return;
      if (lotOf(c.lot_position) !== "sv") return;
      m[c.lot_position.toUpperCase()] = c;
    });
    return m;
  }, [cars]);

  // A stall turns blue while its car is on the active pickup list, and
  // checkered while it is only staged. If a different car has since been
  // parked there, the stall stays red.
  useEffect(() => {
    const next = new Set<string>();
    const staged = new Set<string>();
    activePickups.forEach((p) => {
      if (p.kind === "parts") return;
      const live = p.ro_number
        ? cars.find((c) => c.ro_number === p.ro_number)
        : undefined;
      // Claiming clears the car's spot, so fall back to the spot recorded on
      // the submission to keep the stall blue until the pickup leaves the list.
      const liveSpot = normalizeSpot(live?.lot_position ?? null);
      const spot =
        liveSpot && liveSpot !== "UNKNOWN" ? liveSpot : normalizeSpot(p.lot_position);
      if (!spot || lotOf(spot) !== "sv") return;
      const occupant = byPos[spot];
      if (occupant && occupant.ro_number !== p.ro_number) return;
      if (p.is_staged) staged.add(spot);
      else next.add(spot);
    });
    // A real pickup always wins over a stage on the same spot.
    next.forEach((s) => staged.delete(s));
    setPickupSpots(next);
    setStagedSpots(staged);
  }, [activePickups, cars, byPos]);

  const carsInCP = useMemo(
    () => cars.filter((c) => c.lot_position?.toUpperCase() === "CP"),
    [cars],
  );
  const carsInBL = useMemo(
    () => cars.filter((c) => c.lot_position?.toUpperCase() === "BL"),
    [cars],
  );
  // Unknown location OR a location without a tab (BAY / custom) — only via search.
  const carsOffLot = useMemo(
    () => cars.filter((c) => lotOf(c.lot_position) === null),
    [cars],
  );

  const spots = useMemo(() => spotsForLot(tab), [tab]);

  const filteredNumbered = useMemo(() => {
    if (tab !== "sv") return [];
    const list = spots.map((s) => ({ spot: s, car: byPos[s] }));
    const n = q.trim().toLowerCase();
    if (!n) return list;
    return list.filter(({ spot, car }) =>
      spot.toLowerCase().includes(n) ||
      car?.tag_number?.toLowerCase().includes(n) ||
      car?.ro_number?.toLowerCase().includes(n) ||
      car?.car_model?.toLowerCase().includes(n),
    );
  }, [spots, byPos, q, tab]);

  const filteredFreeform = useMemo(() => {
    const source = tab === "cp" ? carsInCP : tab === "bl" ? carsInBL : [];
    const n = q.trim().toLowerCase();
    if (!n) return source;
    return source.filter((c) =>
      c.tag_number?.toLowerCase().includes(n) ||
      c.ro_number?.toLowerCase().includes(n) ||
      c.car_model?.toLowerCase().includes(n),
    );
  }, [tab, carsInCP, carsInBL, q]);

  // Cars with an UNKNOWN or custom location — always browsable from every tab so
  // a car without a spot is never invisible, and filtered when searching.
  const filteredUnknown = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return carsOffLot;
    return carsOffLot.filter((c) =>
      c.tag_number?.toLowerCase().includes(n) ||
      c.ro_number?.toLowerCase().includes(n) ||
      c.car_model?.toLowerCase().includes(n) ||
      c.lot_position?.toLowerCase().includes(n),
    );
  }, [carsOffLot, q]);


  // Cross-lot search: auto-switch tab if the query matches a car in another lot.
  useEffect(() => {
    const n = q.trim().toLowerCase();
    if (!n) return;
    const matches = (c: ParkedCar) =>
      c.lot_position?.toLowerCase().includes(n) ||
      c.tag_number?.toLowerCase().includes(n) ||
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

  // Live dropdown suggestions across every lot, like the Park tab.
  const suggestions = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return cars
      .filter((c) =>
        c.ro_number?.toLowerCase().includes(n) ||
        c.tag_number?.toLowerCase().includes(n) ||
        c.car_model?.toLowerCase().includes(n) ||
        c.lot_position?.toLowerCase().includes(n),
      )
      .slice(0, 8);
  }, [cars, q]);

  const filled = tab === "sv" ? spots.filter((s) => byPos[s]).length : 0;

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
            onChange={(e) => { setQ(e.target.value); setSuggestOpen(true); }}
            onFocus={() => setSuggestOpen(true)}
            placeholder="Search RO#"
            className="w-full rounded-xl bg-muted py-2.5 pl-9 pr-3 text-base outline-none placeholder:text-muted-foreground"
          />
          {suggestOpen && q.trim() && suggestions.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
              {suggestions.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSuggestOpen(false);
                      navigate({ to: "/park", search: { id: c.id } });
                    }}
                    className="flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left last:border-b-0 active:bg-accent"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden whitespace-nowrap rounded-full bg-primary/10 text-[11px] font-bold leading-none tracking-tight text-primary">
                      {spotBadge(c.lot_position)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {c.ro_number ? `RO #${c.ro_number}` : "No RO #"}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {c.car_model ?? "—"} · {normalizeSpot(c.lot_position) === "UNKNOWN" ? "Unknown" : c.lot_position}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-3 flex gap-2">
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

        <p className="px-1 pt-1 text-[11px] text-muted-foreground">
           {tab === "sv" && `${filled} of ${spots.length} SV spots occupied`}
           {tab === "cp" && `${carsInCP.length} car${carsInCP.length === 1 ? "" : "s"} in CP`}
           {tab === "bl" && `${carsInBL.length} car${carsInBL.length === 1 ? "" : "s"} in BL`}
        </p>
      </header>

      <PeopleSearchResults q={q} />



      {tab === "sv" ? (
        <div className="px-3">
          <LotMap
            spots={filteredNumbered.map(({ spot }) => spot)}
            carsBySpot={byPos}
            pickupSpots={pickupSpots}
            stagedSpots={stagedSpots}
            onSelect={(car) => navigate({ to: "/park", search: { id: car.id } })}
            onSelectEmpty={(spot) => setEmptySpot(spot)}
          />
        </div>
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
               {tab === "cp" ? "No cars in CP." : "No cars in BL."}
            </li>
          )}
        </ul>
      )}

      {filteredUnknown.length > 0 && (
        <>
          <p className="mx-4 mt-4 mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Other locations ({filteredUnknown.length})
          </p>
          <ul className="mx-3 overflow-hidden rounded-2xl bg-background">
            {filteredUnknown.map((car) => (
              <li key={car.id} className="border-b border-border last:border-b-0">
                <Link to="/park" search={{ id: car.id }} className="flex items-center gap-3 px-4 py-3 active:bg-accent">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                    {normalizeSpot(car.lot_position) === "UNKNOWN" ? "?" : "★"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {car.ro_number ? `RO #${car.ro_number}` : "No RO #"}
                      {car.car_model && <span className="text-muted-foreground"> · {car.car_model}</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {normalizeSpot(car.lot_position) === "UNKNOWN"
                        ? "Unknown"
                        : normalizeSpot(car.lot_position) === "BAY"
                          ? "Technician Bay"
                          : car.lot_position}
                    </p>
                  </div>

                </Link>
              </li>
            ))}
          </ul>
        </>
      )}


      {emptySpot && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
          <div className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold">Spot {emptySpot}</p>
                <p className="text-sm text-muted-foreground">
                  {pickupSpots.has(emptySpot) ? "On the pickup list" : "Open — no car logged here"}
                </p>
              </div>
              <button
                onClick={() => setEmptySpot(null)}
                aria-label="Close"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted active:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <dl className="mb-4 space-y-1 rounded-xl bg-surface px-3 py-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Lot</dt><dd className="font-medium">SV</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Spot</dt><dd className="font-medium">{emptySpot.replace("SV ", "")}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Status</dt><dd className="font-medium">Empty</dd></div>
            </dl>
            <button
              onClick={() => { const spot = emptySpot; setEmptySpot(null); navigate({ to: "/park", search: { spot } }); }}
              className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground active:scale-[0.98]"
            >
              Add A Car To This Spot
            </button>
          </div>
        </div>
      )}

      <BottomBar active="lot" />
    </div>
  );
}

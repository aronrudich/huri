import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Clock, CheckCircle2, Search, Map as MapIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeGeneration, handleChannelStatus } from "@/lib/realtime-recovery";
import { useAuth } from "@/lib/auth-context";
import { BottomBar, HuriLogo, TopActions } from "@/components/BottomBar";
import { toast } from "sonner";
import { format } from "date-fns";
import { adjacentSpots, spotsForLot, lotOf, locationLabel, spotBadge } from "@/lib/lot";
import { notify } from "@/lib/push";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { directoryQuery, parkedCarsQuery, pickupsQuery } from "@/lib/queries";
import { PeopleSearchResults } from "@/components/PeopleSearchResults";
import { LotMap } from "@/components/LotMap";
import { canCancelAnyRole, canSeeKind, isShuttleRole, isSpectatorRole, isValetRole } from "@/lib/roles";


/** Claimed submissions leave the list 20 minutes after the claim. */
const CLAIM_HIDE_MS = 20 * 60 * 1000;
/** One claim at a time: a valet waits this long before claiming another. */


const isTechSource = (role: string | null | undefined) =>
  role === "Technician" || role === "Shop Foreman";


export const Route = createFileRoute("/pickup")({
  head: () => ({ meta: [{ title: "Pickup Queue · Huri" }] }),
  component: PickupPage,
});

type Pickup = {
  id: string; tag_number: string | null; ro_number: string | null;
  advisor_name: string | null; car_model: string | null; status: string;
  claimed_by: string | null; claimed_at: string | null; created_at: string;
  requested_by?: string | null;
  source_role: string | null; kind: string | null;
  lot_position: string | null; car_notes: string | null;
  is_staged?: boolean | null;
  customer_name?: string | null; customer_phone?: string | null;
  shuttle_kind?: string | null; customer_address?: string | null;
};

type ParkedCar = {
  id: string; tag_number: string | null; ro_number: string | null;
  car_model: string | null; lot_position: string; notes: string | null;
  is_staged?: boolean | null; located_at?: string | null;
};

function PickupPage() {
  // Bumped when the app returns from the background so channels rebuild.
  const realtimeGen = useRealtimeGeneration();
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  // Spectators can watch the queue but never claim or cancel anything.
  const isSpectator = isSpectatorRole(profile?.role_name);
  const queryClient = useQueryClient();
  // Both lists are React Query caches now: revisiting the tab paints from cache
  // and realtime events patch the cache directly (no full-table refetches).
  const { data: pickups = [], isPending: pickupsPending } = useQuery({ ...pickupsQuery<Pickup>(), enabled: !!user });
  const { data: allCars = [] } = useQuery({ ...parkedCarsQuery(), enabled: !!user });
  const { data: profiles = {} } = useQuery({
    ...directoryQuery(),
    enabled: !!user,
    select: (map) => {
      const m: Record<string, string> = {};
      Object.entries(map).forEach(([id, p]) => { m[id] = p.name; });
      return m;
    },
  });
  const carsByRo = useMemo(() => {
    const byRo: Record<string, ParkedCar> = {};
    allCars.forEach((c) => { if (c.ro_number) byRo[c.ro_number] = c; });
    return byRo;
  }, [allCars]);
  const carsByPos = useMemo(() => {
    const byPos: Record<string, ParkedCar> = {};
    allCars.forEach((c) => {
      if (c.lot_position && c.lot_position !== "UNKNOWN") byPos[c.lot_position.toUpperCase()] = c;
    });
    return byPos;
  }, [allCars]);
  const [q, setQ] = useState("");
  // Spot to locate on the SV map overlay (null = overlay closed).
  const [mapSpot, setMapSpot] = useState<string | null>(null);
  // Shuttle submission opened for details.
  const [detail, setDetail] = useState<Pickup | null>(null);
  const svSpots = useMemo(() => spotsForLot("sv"), []);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);

  /** Safety net for events a payload can't fully describe. */
  const loadCars = async () => {
    await queryClient.invalidateQueries({ queryKey: ["parked-cars"] });
  };
  const setPickups = (updater: (cur: Pickup[]) => Pickup[]) => {
    queryClient.setQueryData<Pickup[]>(["pickups"], (cur) => updater(cur ?? []));
  };

  useEffect(() => {
    if (!user) return;

    // Realtime events patch the caches from their payloads; only cases the
    // payload can't resolve (missing row identity) fall back to a refetch.
    const chan = supabase.channel("pickup-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "pickup_requests" }, (payload) => {
        const row = payload.new as Pickup | undefined;
        const oldId = (payload.old as { id?: string } | undefined)?.id;
        queryClient.setQueryData<Pickup[]>(["pickups"], (cur) => {
          const list = cur ?? [];
          if (payload.eventType === "DELETE") {
            if (!oldId) { void queryClient.invalidateQueries({ queryKey: ["pickups"] }); return list; }
            return list.filter((p) => p.id !== oldId);
          }
          if (!row?.id) { void queryClient.invalidateQueries({ queryKey: ["pickups"] }); return list; }
          // Completed or canceled submissions drop out of the open queue.
          if (row.status !== "unclaimed" && row.status !== "claimed") {
            return list.filter((p) => p.id !== row.id);
          }
          const next = list.some((p) => p.id === row.id)
            ? list.map((p) => (p.id === row.id ? row : p))
            : [row, ...list];
          return next.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "parked_cars" }, (payload) => {
        const row = payload.new as ParkedCar | undefined;
        const oldId = (payload.old as { id?: string } | undefined)?.id;
        queryClient.setQueryData<ParkedCar[]>(["parked-cars"], (cur) => {
          const list = cur ?? [];
          if (payload.eventType === "DELETE") {
            if (!oldId) { void loadCars(); return list; }
            return list.filter((c) => c.id !== oldId);
          }
          if (!row?.id) { void loadCars(); return list; }
          return list.some((c) => c.id === row.id)
            ? list.map((c) => (c.id === row.id ? row : c))
            : [...list, row];
        });
      })
      .subscribe(handleChannelStatus);
    return () => { supabase.removeChannel(chan); };
  }, [user, queryClient, realtimeGen]);

  // In-app realtime alert.
  //   - Regular car pickups → notify anyone with a Valet-type role.
  //   - Parts/shuttle requests → same valet/shuttle audience; anyone can claim them.
  useEffect(() => {
    if (!profile) return;
    const role = profile.role_name;
    if (!isValetRole(role) && !isShuttleRole(role)) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const chan = supabase.channel("valet-pickup-alert")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pickup_requests" }, (payload) => {
        const p = payload.new as Pickup;
        if (!canSeeKind(role, p.kind)) return;
        const title = p.is_staged
          ? "🏁 Car staged — bring to CP"
          : p.kind === "parts"
          ? "🔧 Parts request"
          : p.kind === "shuttle"
            ? "🚐 Shuttle request"
            : p.kind === "wash"
              ? "🧼 Wash request"
              : p.kind === "park"
                ? "🅿️ Park request"
                : "New pickup request";
        notify(
          title,
          [p.ro_number && `RO #${p.ro_number}`, p.advisor_name]
            .filter(Boolean).join(" · ") || "Open Huri",
          "/pickup",
        );
      })
      .subscribe(handleChannelStatus);
    return () => { supabase.removeChannel(chan); };
  }, [profile, realtimeGen]);

  // Auto-archive claimed pickups/parts after 20 minutes without changing their
  // saved spot snapshot. The car's destination is applied the moment it is
  // claimed, so nothing here touches car locations and no car is ever deleted.
  useEffect(() => {
    const archiveExpired = () => {
      const now = Date.now();
      pickups.forEach((p) => {
        if (p.status === "claimed" && p.claimed_at && now - new Date(p.claimed_at).getTime() >= CLAIM_HIDE_MS) {
          supabase
            .from("pickup_requests")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", p.id)
            .then(() => loadCars());
        }
      });
    };
    archiveExpired();
    const t = setInterval(() => {
      archiveExpired();
    }, 30000);
    return () => clearInterval(t);
  }, [pickups]);



  const claim = async (p: Pickup) => {
    if (!user) return;
    const { data: claimed, error } = await supabase.rpc("claim_pickup_request", { _pickup_id: p.id });
    if (error) return toast.error(error.message);
    if (claimed) setPickups((current) => current.map((item) => item.id === p.id ? claimed as Pickup : item));
    await loadCars();
    toast.success("Claimed");
  };


  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return allCars
      .filter((c) =>
        c.tag_number?.toLowerCase().includes(n) ||
        c.ro_number?.toLowerCase().includes(n) ||
        c.car_model?.toLowerCase().includes(n) ||
        c.lot_position?.toLowerCase().includes(n),
      )
      .slice(0, 8);
  }, [q, allCars]);

  // Parts requests are visible and claimable by everyone in the pickup list.
  const visiblePickups = useMemo(
    () => pickups.filter((p) => {
      if (!canSeeKind(profile?.role_name, p.kind)) return false;
      if (p.status === "claimed" && p.claimed_at) {
        return Date.now() - new Date(p.claimed_at).getTime() < CLAIM_HIDE_MS;
      }
      return true;
    }),
    [pickups, profile],
  );


  // Unclaimed customer pickups first, then unclaimed technician pickups, then
  // staged cars (lowest priority of all), each oldest first.
  const sortedPickups = useMemo(() => {
    const byAge = (a: Pickup, b: Pickup) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    const unclaimed = visiblePickups.filter((p) => p.status === "unclaimed");
    const unclaimedCustomer = unclaimed
      .filter((p) => !p.is_staged)
      .filter((p) => p.kind === "parts" || p.kind === "shuttle" || !isTechSource(p.source_role))
      .sort(byAge);
    const unclaimedTech = unclaimed
      .filter((p) => !p.is_staged && p.kind !== "parts" && p.kind !== "shuttle" && isTechSource(p.source_role))
      .sort(byAge);
    const unclaimedStaged = unclaimed.filter((p) => !!p.is_staged).sort(byAge);
    const claimed = visiblePickups
      .filter((p) => p.status === "claimed")
      .sort((a, b) => new Date(b.claimed_at ?? b.created_at).getTime() - new Date(a.claimed_at ?? a.created_at).getTime());
    return [...unclaimedCustomer, ...unclaimedTech, ...unclaimedStaged, ...claimed];
  }, [visiblePickups]);

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
            placeholder="Search RO#"
            className="w-full rounded-xl bg-muted py-2.5 pl-9 pr-3 text-base outline-none placeholder:text-muted-foreground"
          />
        </div>
        <p className="px-1 pt-1 text-[11px] text-muted-foreground">
          {visiblePickups.filter((p) => p.status === "unclaimed").length} unclaimed · tap a search result to edit a car
        </p>
      </header>

      <PeopleSearchResults q={q} />

      {q.trim() && (

        <ul className="mx-3 mb-3 overflow-hidden rounded-2xl bg-background">
          {matches.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">No cars match "{q}"</li>
          )}
          {matches.map((c) => (
            <li key={c.id}>
              <Link
                to="/park"
                search={{ ro: c.ro_number ?? undefined }}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 active:bg-accent"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden whitespace-nowrap rounded-full bg-primary/10 text-[11px] font-bold leading-none tracking-tight text-primary">
                  {spotBadge(c.lot_position)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {c.ro_number ? `RO #${c.ro_number}` : "No RO #"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.car_model ?? "—"} · {c.lot_position === "UNKNOWN" ? "Spot unknown" : `Spot ${c.lot_position}`}
                  </p>
                </div>
                <span className="text-xs font-semibold text-primary">Edit</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <ul className="space-y-2 px-3 pt-1">
        {pickupsPending && sortedPickups.length === 0 && (
          <li className="rounded-2xl bg-background px-5 py-12" aria-hidden />
        )}
        {!pickupsPending && sortedPickups.length === 0 && (
          <li className="rounded-2xl bg-background px-5 py-12 text-center text-sm text-muted-foreground">
            No active pickups.
          </li>
        )}
        {sortedPickups.map((p) => {
          const isParts = p.kind === "parts";
          const isShuttle = p.kind === "shuttle";
          const liveCar = !isParts && !isShuttle && p.ro_number ? carsByRo[p.ro_number] : undefined;
          // Claimed pickups must keep showing the saved spot snapshot even after
          // the live parked_cars row is deleted to free the spot in the lot list.
          const displayCar = p.status === "claimed" ? undefined : liveCar;
          const effectiveSpot = !isParts && !isShuttle
            ? p.status === "claimed"
              ? (p.lot_position ?? "UNKNOWN")
              : (displayCar?.lot_position ?? p.lot_position ?? "UNKNOWN")
            : null;
          const effectiveNotes = displayCar?.notes ?? p.car_notes ?? null;
          // A pickup submitted for an RO that was never logged into Huri has no
          // spot snapshot and no live car row — say so instead of "Unknown".
          const hasCarRecord = !isParts && !isShuttle && (!!liveCar || (!!p.lot_position && p.lot_position !== "UNKNOWN") || p.status !== "unclaimed");
          const isSvSpot = lotOf(effectiveSpot) === "sv";
          const adj = effectiveSpot ? adjacentSpots(effectiveSpot) : [];
          const blockers = adj.map((pos: string) => carsByPos[pos]).filter(Boolean) as ParkedCar[];
          const isTech = isTechSource(p.source_role);
          const isStaged = !!p.is_staged;
          // Everyone can cancel their own submission; technicians can only cancel
          // their own so nobody kills another employee's request.
          const canCancel = !isSpectator && ((!!user && p.requested_by === user.id) || canCancelAnyRole(profile?.role_name));
          // Every card looks the same; only this small pill is colored so the
          // list stays uniform and the type still reads at a glance.
          const pillLabel = isStaged
            ? "Staged"
            : isShuttle
              ? p.shuttle_kind === "dropoff" ? "Shuttle drop off" : "Shuttle"
              : isParts
                ? "Parts"
                : p.kind === "wash"
                  ? "🧼 Wash"
                  : p.kind === "park"
                    ? "Park request"
                    : isTech
                      ? "Technician pickup"
                      : "Pickup";
          const pillClass = isStaged
            ? "bg-foreground text-background"

            : isShuttle
              ? "bg-success text-success-foreground"
              : isParts
                ? "bg-warning text-warning-foreground"
                : p.kind === "wash"
                  ? "bg-wash text-wash-foreground"
                  : p.kind === "park"
                    ? "bg-success text-success-foreground"
                    : isTech
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-primary text-primary-foreground";

          return (
            <li
              key={p.id}
              onClick={isShuttle ? () => setDetail(p) : undefined}
              className={`overflow-hidden rounded-2xl border border-border bg-background ${isShuttle ? "cursor-pointer" : ""}`}
            >
              <div className="px-4 py-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${pillClass}`}>
                    {pillLabel}
                  </span>

                  {p.status === "claimed" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
                      <CheckCircle2 className="h-3 w-3" /> In Progress
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(p.created_at), "h:mm a")}
                    </span>
                  )}
                </div>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold">
                      {isParts
                        ? `Parts for ${p.advisor_name ?? "employee"}`
                        : isShuttle
                          ? (p.customer_name ?? "Shuttle request")
                          : p.ro_number ? `RO #${p.ro_number}` : "Pickup request"}
                    </p>
                    {isShuttle && (
                      <>
                        {p.customer_phone && (
                          <a
                            href={`tel:${p.customer_phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm font-semibold text-primary underline"
                          >
                            {p.customer_phone}
                          </a>
                        )}
                        {p.customer_address && (
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Address:</span> {p.customer_address}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {[p.ro_number && `RO #${p.ro_number}`, p.advisor_name, format(new Date(p.created_at), "h:mm a")].filter(Boolean).join(" · ")}
                        </p>
                        {p.car_notes && (
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            <span className="font-medium">Note:</span> {p.car_notes}
                          </p>
                        )}
                      </>
                    )}
                    {!isParts && !isShuttle && (
                      <>
                        <p className="text-sm text-muted-foreground">
                          {[displayCar?.car_model ?? p.car_model, p.advisor_name, format(new Date(p.created_at), "h:mm a")].filter(Boolean).join(" · ")}
                        </p>
                        {effectiveNotes && (
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            <span className="font-medium">Note:</span> {effectiveNotes}
                          </p>
                        )}
                      </>
                    )}
                    {isParts && (
                      <>
                        {p.ro_number && <p className="text-sm text-muted-foreground">RO #{p.ro_number}</p>}
                        {p.car_notes && <p className="mt-0.5 text-sm text-muted-foreground"><span className="font-medium">Note:</span> {p.car_notes}</p>}
                      </>
                    )}
                  </div>
                  {isTech && (
                    <span className="shrink-0 text-xs font-bold text-destructive">Technician</span>
                  )}
                </div>

                {!isParts && (
                  <div className="mb-2 rounded-xl bg-surface px-3 py-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Location:</span>{" "}
                      <span className="font-semibold">
                        {hasCarRecord
                          ? locationLabel(effectiveSpot)
                          : "Unknown"}
                      </span>
                    </p>
                    {isSvSpot && blockers.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Blocked by:</span>{" "}
                        {blockers.map((b, i) => (
                          <span key={b.id}>
                            {i > 0 && " and "}
                            {b.lot_position} ({b.ro_number ? `RO #${b.ro_number}` : "no RO"}
                            {b.car_model && ` · ${b.car_model}`})
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                )}


                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {p.status === "unclaimed" ? (
                    isSpectator ? (
                      <p className="flex-1 text-xs text-muted-foreground">Unclaimed</p>
                    ) : (
                      <button
                        onClick={() => claim(p)}
                        className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground active:scale-[0.98] disabled:opacity-50"
                      >
                        {isParts ? "On it" : "Claim"}
                      </button>
                    )
                  ) : (
                    <p className="flex-1 text-xs text-muted-foreground">
                      {isParts ? "Handled" : "Claimed"} by {p.claimed_by ? (profiles[p.claimed_by] ?? "valet") : "valet"}
                      {p.claimed_at && ` · ${format(new Date(p.claimed_at), "h:mm a")}`}
                    </p>
                  )}
                  {!isParts && (
                    <button
                      onClick={() => effectiveSpot && setMapSpot(effectiveSpot)}
                      disabled={!effectiveSpot || lotOf(effectiveSpot) !== "sv"}
                      aria-label="Show on lot map"
                      className="flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-3 text-xs font-semibold text-muted-foreground active:bg-accent disabled:opacity-40"
                    >
                      <MapIcon className="h-4 w-4" /> Map
                    </button>
                  )}

                  {canCancel && (
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Cancel this ${isParts ? "parts request" : "pickup"}? It disappears from the list but the car stays where it is.`)) return;
                      const { error } = await supabase.from("pickup_requests")
                        .update({ status: "canceled", completed_at: new Date().toISOString() })
                        .eq("id", p.id);
                      if (error) return toast.error(error.message);
                      // Canceling puts the car back where it was before the pickup was submitted.
                      // Canceling a stage also clears the car's staged flag so its map spot returns to red.
                      const originalSpot = p.lot_position;
                      if (!isParts && p.ro_number) {
                        const patch: { lot_position?: string; is_staged?: boolean } = {};
                        if (originalSpot && originalSpot !== "UNKNOWN") patch.lot_position = originalSpot;
                        if (isStaged) patch.is_staged = false;
                        if (Object.keys(patch).length) {
                          await supabase.from("parked_cars").update(patch).eq("ro_number", p.ro_number);
                          await loadCars();
                        }
                      }
                      setPickups((cur) => cur.filter((x) => x.id !== p.id));
                      toast.message("Canceled");
                    }}

                    className="rounded-xl border border-border bg-background px-3 py-3 text-xs font-semibold text-muted-foreground active:bg-accent"
                  >
                    Cancel
                  </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {mapSpot && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 safe-top">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">SV lot map</p>
              <p className="text-xs text-muted-foreground">
                Pick up <span className="font-semibold text-primary">{mapSpot}</span> (blue)
              </p>
            </div>
            <button
              onClick={() => setMapSpot(null)}
              aria-label="Close map"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted active:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Whole lot fitted on screen at once, mobile and desktop. */}
          <div className="min-h-0 flex-1 overflow-hidden px-3 py-2 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-6">

            <LotMap
              spots={svSpots}
              carsBySpot={carsByPos}
              highlightSpot={mapSpot}
              staticView
            />
          </div>

        </div>
      )}


      <BottomBar active="pickup" />
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Clock, CheckCircle2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BottomBar, HuriLogo, TopActions } from "@/components/BottomBar";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { adjacentSpots } from "@/lib/lot";
import { notify } from "@/lib/push";
import { getDirectory } from "@/lib/directory.functions";
import { PeopleSearchResults } from "@/components/PeopleSearchResults";


const CLAIM_HIDE_MS = 60 * 60 * 1000;

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
  source_role: string | null; kind: string | null;
  lot_position: string | null; car_notes: string | null;
};

type ParkedCar = {
  id: string; tag_number: string | null; ro_number: string | null;
  car_model: string | null; lot_position: string; notes: string | null;
};

function PickupPage() {
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [allCars, setAllCars] = useState<ParkedCar[]>([]);
  const [carsByRo, setCarsByRo] = useState<Record<string, ParkedCar>>({});
  const [carsByPos, setCarsByPos] = useState<Record<string, ParkedCar>>({});
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);

  const loadCars = async () => {
    const { data } = await supabase.from("parked_cars").select("*");
    const cars = (data as ParkedCar[]) ?? [];
    const byRo: Record<string, ParkedCar> = {};
    const byPos: Record<string, ParkedCar> = {};
    cars.forEach((c) => {
      if (c.ro_number) byRo[c.ro_number] = c;
      if (c.lot_position && c.lot_position !== "UNKNOWN") byPos[c.lot_position.toUpperCase()] = c;
    });
    setAllCars(cars);
    setCarsByRo(byRo);
    setCarsByPos(byPos);
  };

  useEffect(() => {
    if (!user) return;
    const loadPickups = () => {
      supabase.from("pickup_requests")
        .select("*").neq("status", "completed").order("created_at", { ascending: false })
        .then(({ data }) => setPickups((data as Pickup[]) ?? []));
    };
    loadPickups();
    loadCars();
    getDirectory().then((data) => {
      const m: Record<string, string> = {};
      data?.forEach((p) => { if (p.id) m[p.id] = p.nickname || p.full_name || ""; });
      setProfiles(m);
    });

    const chan = supabase.channel("pickup-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "pickup_requests" }, () => {
        loadPickups();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "parked_cars" }, () => loadCars())
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [user]);

  // In-app realtime alert.
  //   - Regular car pickups → notify anyone with a Valet-type role.
  //   - Parts requests → notify ONLY Valet & Parts (server push is already scoped that way).
  useEffect(() => {
    if (!profile) return;
    const role = profile.role_name;
    const isValet = role === "Valet" || role === "Valet & Parts";
    if (!isValet) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const chan = supabase.channel("valet-pickup-alert")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pickup_requests" }, (payload) => {
        const p = payload.new as Pickup;
        if (p.kind === "parts" && role !== "Valet & Parts") return;
        const title = p.kind === "parts" ? "🔧 Parts request" : "New pickup request";
        notify(
          title,
          [p.ro_number && `RO #${p.ro_number}`, p.advisor_name]
            .filter(Boolean).join(" · ") || "Open Huri",
          "/pickup",
        );
      })
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [profile]);

  // Auto-archive claimed pickups/parts after 60 minutes.
  // Technician-submitted pickups land in Lot T (tech lot / bay); everything else becomes UNKNOWN.
  useEffect(() => {
    const archiveExpired = () => {
      const now = Date.now();
      pickups.forEach((p) => {
        if (p.status === "claimed" && p.claimed_at && now - new Date(p.claimed_at).getTime() >= CLAIM_HIDE_MS) {
          supabase.from("pickup_requests").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", p.id).then();
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
        c.ro_number?.toLowerCase().includes(n) ||
        c.car_model?.toLowerCase().includes(n) ||
        c.lot_position?.toLowerCase().includes(n),
      )
      .slice(0, 8);
  }, [q, allCars]);

  // Parts requests are visible to everyone in the pickup list; only Valet & Parts get push notifications.
  const visiblePickups = useMemo(
    () => pickups.filter((p) => {
      if (p.status === "claimed" && p.claimed_at) {
        return Date.now() - new Date(p.claimed_at).getTime() < CLAIM_HIDE_MS;
      }
      return true;
    }),
    [pickups],
  );


  // Unclaimed customer pickups first, then unclaimed technician pickups, each oldest first.
  const sortedPickups = useMemo(() => {
    const unclaimedCustomer = visiblePickups
      .filter((p) => p.status === "unclaimed")
      .filter((p) => p.kind === "parts" || !isTechSource(p.source_role))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const unclaimedTech = visiblePickups
      .filter((p) => p.status === "unclaimed" && p.kind !== "parts" && isTechSource(p.source_role))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const claimed = visiblePickups
      .filter((p) => p.status === "claimed")
      .sort((a, b) => new Date(a.claimed_at ?? a.created_at).getTime() - new Date(b.claimed_at ?? b.created_at).getTime());
    return [...unclaimedCustomer, ...unclaimedTech, ...claimed];
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
            placeholder="Search"
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
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {c.lot_position === "UNKNOWN" ? "?" : c.lot_position}
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
        {sortedPickups.length === 0 && (
          <li className="rounded-2xl bg-background px-5 py-12 text-center text-sm text-muted-foreground">
            No active pickups.
          </li>
        )}
        {sortedPickups.map((p) => {
          const isParts = p.kind === "parts";
          const liveCar = !isParts && p.ro_number ? carsByRo[p.ro_number] : undefined;
          // Claimed pickups must keep showing the saved spot snapshot even after
          // the live parked_cars row is deleted to free the spot in the lot list.
          const displayCar = p.status === "claimed" ? undefined : liveCar;
          const effectiveSpot = !isParts
            ? p.status === "claimed"
              ? (p.lot_position ?? "UNKNOWN")
              : (displayCar?.lot_position ?? p.lot_position ?? "UNKNOWN")
            : null;
          const effectiveNotes = displayCar?.notes ?? p.car_notes ?? null;
          const adj = effectiveSpot ? adjacentSpots(effectiveSpot) : [];
          const blockers = adj.map((pos: string) => carsByPos[pos]).filter(Boolean) as ParkedCar[];
          const isTech = p.source_role === "Technician";
          const ringClass = isParts
            ? "ring-2 ring-warning"
            : isTech
              ? "ring-2 ring-destructive"
              : "ring-2 ring-primary";
          const headerBar = isParts
            ? "bg-warning text-warning-foreground"
            : isTech
              ? "bg-destructive text-destructive-foreground"
              : null;
          const headerLabel = isParts
            ? "🔧 Parts request"
            : isTech
              ? "🚨 Technician pickup"
              : null;
          return (
            <li key={p.id} className={`overflow-hidden rounded-2xl bg-background ${ringClass}`}>
              {headerBar && (
                <div className={`${headerBar} px-4 py-1.5 text-xs font-semibold uppercase tracking-wide`}>
                  {headerLabel}
                </div>
              )}
              <div className="px-4 py-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold">
                      {isParts
                        ? `Parts for ${p.advisor_name ?? "employee"}`
                        : p.ro_number ? `RO #${p.ro_number}` : "Pickup request"}
                    </p>
                    {!isParts && (
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
                  {p.status === "claimed" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
                      <CheckCircle2 className="h-3 w-3" /> In Progress
                    </span>
                  ) : (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${isTech ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
                      <Clock className="h-3 w-3" /> {formatDistanceToNow(new Date(p.created_at), { addSuffix: false })} ago
                    </span>
                  )}
                </div>

                {!isParts && effectiveSpot && (
                  <div className="mb-2 rounded-xl bg-surface px-3 py-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Parked at:</span>{" "}
                      <span className="font-semibold">
                        {effectiveSpot === "UNKNOWN" ? "Spot unknown" : `Spot ${effectiveSpot}`}
                      </span>
                    </p>
                    {blockers.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Blocked by:</span>{" "}
                        {blockers.map((b, i) => (
                          <span key={b.id}>
                            {i > 0 && " and "}
                            Spot {b.lot_position} ({b.ro_number ? `RO #${b.ro_number}` : "no RO"}
                            {b.car_model && ` · ${b.car_model}`})
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {p.status === "unclaimed" ? (
                    <button onClick={() => claim(p)} className={`flex-1 rounded-xl py-3 text-sm font-semibold active:scale-[0.98] ${isParts ? "bg-warning text-warning-foreground" : isTech ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>
                      {isParts ? "On it" : "Claim"}
                    </button>
                  ) : (
                    <p className="flex-1 text-xs text-muted-foreground">
                      {isParts ? "Handled" : "Claimed"} by {p.claimed_by ? (profiles[p.claimed_by] ?? "valet") : "valet"}
                      {p.claimed_at && ` · ${format(new Date(p.claimed_at), "h:mm a")}`}
                    </p>
                  )}
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Cancel this ${isParts ? "parts request" : "pickup"}? It disappears from the list but the car stays where it is.`)) return;
                      const { error } = await supabase.from("pickup_requests")
                        .update({ status: "completed", completed_at: new Date().toISOString() })
                        .eq("id", p.id);
                      if (error) return toast.error(error.message);
                      // Canceling puts the car back where it was before the pickup was submitted.
                      const originalSpot = p.lot_position;
                      if (!isParts && p.ro_number && originalSpot && originalSpot !== "UNKNOWN") {
                        await supabase.from("parked_cars")
                          .update({ lot_position: originalSpot })
                          .eq("ro_number", p.ro_number);
                        await loadCars();
                      }
                      setPickups((cur) => cur.filter((x) => x.id !== p.id));
                      toast.message("Canceled");
                    }}

                    className="rounded-xl border border-border bg-background px-3 py-3 text-xs font-semibold text-muted-foreground active:bg-accent"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <BottomBar active="pickup" />
    </div>
  );
}

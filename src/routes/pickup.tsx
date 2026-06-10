import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock, CheckCircle2, AlertTriangle, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BottomBar } from "@/components/BottomBar";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { adjacentSpots } from "@/lib/lot";

export const Route = createFileRoute("/pickup")({
  head: () => ({ meta: [{ title: "Pickup Queue · Huri" }] }),
  component: PickupPage,
});

type Pickup = {
  id: string; tag_number: string | null; ro_number: string | null;
  advisor_name: string | null; car_model: string | null; status: string;
  claimed_by: string | null; claimed_at: string | null; created_at: string;
};

type ParkedCar = {
  id: string; tag_number: string; ro_number: string | null;
  car_model: string | null; lot_position: string; notes: string | null;
};

function PickupPage() {
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [allCars, setAllCars] = useState<ParkedCar[]>([]);
  const [carsByTag, setCarsByTag] = useState<Record<string, ParkedCar>>({});
  const [carsByPos, setCarsByPos] = useState<Record<string, ParkedCar>>({});
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);

  const loadCars = async () => {
    const { data } = await supabase.from("parked_cars").select("*");
    const cars = (data as ParkedCar[]) ?? [];
    const byTag: Record<string, ParkedCar> = {};
    const byPos: Record<string, ParkedCar> = {};
    cars.forEach((c) => {
      byTag[c.tag_number] = c;
      if (c.lot_position && c.lot_position !== "UNKNOWN") byPos[c.lot_position.toUpperCase()] = c;
    });
    setAllCars(cars);
    setCarsByTag(byTag);
    setCarsByPos(byPos);
  };

  useEffect(() => {
    if (!user) return;
    supabase.from("pickup_requests")
      .select("*").neq("status", "completed").order("created_at", { ascending: true })
      .then(({ data }) => setPickups((data as Pickup[]) ?? []));
    loadCars();
    supabase.from("profiles").select("id, full_name, nickname").then(({ data }) => {
      const m: Record<string, string> = {};
      data?.forEach((p) => { m[p.id] = p.nickname || p.full_name; });
      setProfiles(m);
    });

    const chan = supabase.channel("pickup-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "pickup_requests" }, () => {
        supabase.from("pickup_requests").select("*").neq("status", "completed")
          .order("created_at", { ascending: true })
          .then(({ data }) => setPickups((data as Pickup[]) ?? []));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "parked_cars" }, () => loadCars())
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [user]);

  // Valet push: any new pickup_request triggers a browser notification for valets
  useEffect(() => {
    if (!profile || profile.role_name !== "Valet") return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const chan = supabase.channel("valet-pickup-alert")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pickup_requests" }, (payload) => {
        const p = payload.new as Pickup;
        if (Notification.permission === "granted") {
          new Notification("New pickup request", {
            body: [p.tag_number && `Tag #${p.tag_number}`, p.ro_number && `RO #${p.ro_number}`, p.advisor_name]
              .filter(Boolean).join(" · ") || "Open Huri",
            icon: "/icon-512.png",
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [profile]);

  // Auto-archive after 45min
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      pickups.forEach((p) => {
        if (p.status === "claimed" && p.claimed_at && now - new Date(p.claimed_at).getTime() > 45 * 60 * 1000) {
          supabase.from("pickup_requests").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", p.id).then();
          if (p.tag_number) supabase.from("parked_cars").update({ lot_position: "UNKNOWN" }).eq("tag_number", p.tag_number).then();
        }
      });
    }, 30000);
    return () => clearInterval(t);
  }, [pickups]);

  const claim = async (p: Pickup) => {
    if (!user) return;
    const { error } = await supabase
      .from("pickup_requests").update({ status: "claimed", claimed_by: user.id, claimed_at: new Date().toISOString() })
      .eq("id", p.id).eq("status", "unclaimed");
    if (error) return toast.error(error.message);
    toast.success("Claimed");
  };

  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return allCars
      .filter((c) =>
        c.tag_number?.toLowerCase().includes(n) ||
        c.ro_number?.toLowerCase().includes(n) ||
        c.car_model?.toLowerCase().includes(n),
      )
      .slice(0, 8);
  }, [q, allCars]);

  return (
    <div className="min-h-screen bg-surface pb-32 safe-top">
      <header className="sticky top-0 z-10 bg-surface/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="mb-3 flex items-center gap-2">
          <Link to="/" className="grid h-9 w-9 place-items-center rounded-full text-primary"><ArrowLeft className="h-5 w-5" /></Link>
          <h1 className="flex-1 text-xl font-bold tracking-tight">Pickup Queue</h1>
          <Link to="/park" className="rounded-full border border-input bg-background px-3 py-1.5 text-xs font-semibold">Park</Link>
          <Link to="/pickup/new" className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Pickup</Link>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Tag # or RO #"
            className="w-full rounded-xl bg-muted py-2.5 pl-9 pr-3 text-base outline-none placeholder:text-muted-foreground"
          />
        </div>
        <p className="px-1 pt-1 text-[11px] text-muted-foreground">
          {pickups.filter((p) => p.status === "unclaimed").length} unclaimed · tap a search result to edit a car
        </p>
      </header>

      {q.trim() && (
        <ul className="mx-3 mb-3 overflow-hidden rounded-2xl bg-background">
          {matches.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">No cars match "{q}"</li>
          )}
          {matches.map((c) => (
            <li key={c.id}>
              <Link
                to="/park"
                search={{ tag: c.tag_number }}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 active:bg-accent"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {c.lot_position === "UNKNOWN" ? "?" : c.lot_position}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    Tag #{c.tag_number}{c.ro_number && ` · RO #${c.ro_number}`}
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

      <ul className="space-y-2 px-3">
        {pickups.length === 0 && (
          <li className="rounded-2xl bg-background px-5 py-12 text-center text-sm text-muted-foreground">
            No active pickups.
          </li>
        )}
        {pickups.map((p) => {
          const car = p.tag_number ? carsByTag[p.tag_number] : undefined;
          const adj = car ? adjacentSpots(car.lot_position) : [];
          const blockers = adj.map((pos: string) => carsByPos[pos]).filter(Boolean) as ParkedCar[];
          const flagged = car?.notes && car.notes.trim().length > 0;
          return (
            <li key={p.id} className="overflow-hidden rounded-2xl bg-background">
              {flagged && (
                <div className="flex items-start gap-2 bg-warning/15 px-4 py-2 text-warning-foreground">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <p className="text-xs font-medium"><span className="font-bold">Note:</span> {car!.notes}</p>
                </div>
              )}
              <div className="px-4 py-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold">
                      {p.tag_number ? `Tag #${p.tag_number}` : p.ro_number ? `RO #${p.ro_number}` : "Pickup request"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {[car?.car_model ?? p.car_model, p.ro_number && `RO #${p.ro_number}`, p.advisor_name].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {p.status === "claimed" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
                      <CheckCircle2 className="h-3 w-3" /> In Progress
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      <Clock className="h-3 w-3" /> {formatDistanceToNow(new Date(p.created_at), { addSuffix: false })} ago
                    </span>
                  )}
                </div>

                {car && (
                  <div className="mb-2 rounded-xl bg-surface px-3 py-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Parked at:</span>{" "}
                      <span className="font-semibold">
                        {car.lot_position === "UNKNOWN" ? "Spot unknown" : `Spot ${car.lot_position}`}
                      </span>
                    </p>
                    {blockers.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Blocked by:</span>{" "}
                        {blockers.map((b, i) => (
                          <span key={b.id}>
                            {i > 0 && " and "}
                            Spot {b.lot_position} (TAG #{b.tag_number}
                            {b.car_model && ` · ${b.car_model}`})
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                )}

                {p.status === "unclaimed" ? (
                  <button onClick={() => claim(p)} className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground active:scale-[0.98]">
                    Claim
                  </button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Claimed by {p.claimed_by ? (profiles[p.claimed_by] ?? "valet") : "valet"}
                    {p.claimed_at && ` · ${formatDistanceToNow(new Date(p.claimed_at), { addSuffix: true })}`}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <BottomBar active="pickup" />
    </div>
  );
}

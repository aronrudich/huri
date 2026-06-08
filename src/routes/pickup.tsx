import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Car as CarIcon, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BottomBar } from "@/components/BottomBar";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { adjacentCoords } from "@/lib/lot";

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
  const { user, loading } = useAuth();
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [carsByTag, setCarsByTag] = useState<Record<string, ParkedCar>>({});
  const [carsByPos, setCarsByPos] = useState<Record<string, ParkedCar>>({});
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);

  const loadCars = async () => {
    const { data } = await supabase.from("parked_cars").select("*");
    const byTag: Record<string, ParkedCar> = {};
    const byPos: Record<string, ParkedCar> = {};
    data?.forEach((c: any) => {
      byTag[c.tag_number] = c;
      if (c.lot_position && c.lot_position !== "UNKNOWN") byPos[c.lot_position.toUpperCase()] = c;
    });
    setCarsByTag(byTag);
    setCarsByPos(byPos);
  };

  useEffect(() => {
    if (!user) return;
    // Best-effort archive (idempotent client-side check via simple update fallback)
    supabase.from("pickup_requests")
      .select("*")
      .neq("status", "completed")
      .order("created_at", { ascending: true })
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

  // Client-side auto-complete after 45min (visual; server fn could do too)
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
      .from("pickup_requests")
      .update({ status: "claimed", claimed_by: user.id, claimed_at: new Date().toISOString() })
      .eq("id", p.id).eq("status", "unclaimed");
    if (error) return toast.error(error.message);
    toast.success("Claimed");
  };

  return (
    <div className="min-h-screen bg-surface pb-32 safe-top">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-surface/95 px-5 pb-3 pt-4 backdrop-blur">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pickup Queue</h1>
          <p className="text-sm text-muted-foreground">{pickups.filter(p => p.status === "unclaimed").length} unclaimed</p>
        </div>
        <Link to="/park" className="rounded-full border border-input bg-background px-4 py-2 text-sm font-semibold">Park a Car</Link>
      </header>

      <ul className="space-y-2 px-3">
        {pickups.length === 0 && (
          <li className="rounded-2xl bg-background px-5 py-12 text-center text-sm text-muted-foreground">
            No active pickups.
          </li>
        )}
        {pickups.map((p) => {
          const car = p.tag_number ? carsByTag[p.tag_number] : undefined;
          const adj = car ? adjacentCoords(car.lot_position) : [];
          const blockers = adj.map((pos) => carsByPos[pos]).filter(Boolean) as ParkedCar[];
          const flagged = car?.notes && car.notes.trim().length > 0;
          return (
            <li key={p.id} className="overflow-hidden rounded-2xl bg-background">
              {flagged && (
                <div className="flex items-start gap-2 bg-warning/15 px-4 py-2 text-warning-foreground">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <p className="text-xs font-medium"><span className="font-bold">Tech note:</span> {car!.notes}</p>
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
                    <p><span className="text-muted-foreground">Parked at:</span> <span className="font-semibold">{car.lot_position}</span></p>
                    {blockers.length > 0 && blockers.map((b) => (
                      <p key={b.id} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Blocked by {b.lot_position}:</span> TAG #{b.tag_number}
                        {b.car_model && ` · ${b.car_model}`}
                        {b.ro_number && ` · RO #${b.ro_number}`}
                      </p>
                    ))}
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

      <Link
        to="/pickup/new"
        className="fixed bottom-24 right-5 z-20 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95"
        aria-label="New pickup request"
      >
        <Plus className="h-7 w-7" />
      </Link>

      <BottomBar active="pickup" />
    </div>
  );
}

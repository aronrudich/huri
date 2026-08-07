import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { HuriLogo, TopActions } from "@/components/BottomBar";
import { toast } from "sonner";

export const Route = createFileRoute("/stage")({
  head: () => ({
    meta: [
      { title: "Stage A Car · Huri" },
      { name: "description", content: "Mark a finished car as staged so a valet can bring it up before the customer arrives." },
      { property: "og:title", content: "Stage A Car · Huri" },
      { property: "og:description", content: "Mark a finished car as staged for customer pickup." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StagePage,
});

type Car = {
  id: string; ro_number: string | null; car_model: string | null;
  lot_position: string; notes: string | null; is_staged?: boolean | null;
};

function StagePage() {
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const [cars, setCars] = useState<Car[]>([]);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const role = profile?.role_name ?? "";
  const canStage = role === "Advisor" || /manager|director/i.test(role);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);

  const load = async () => {
    const { data } = await supabase.from("parked_cars").select("*").order("created_at", { ascending: false });
    setCars((data as Car[]) ?? []);
  };
  useEffect(() => { if (user) void load(); }, [user]);

  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    const base = n
      ? cars.filter((c) =>
          c.ro_number?.toLowerCase().includes(n) ||
          c.car_model?.toLowerCase().includes(n) ||
          c.lot_position?.toLowerCase().includes(n))
      : cars;
    return base.slice(0, 30);
  }, [q, cars]);

  const toggle = async (c: Car) => {
    const next = !c.is_staged;
    setBusyId(c.id);
    const { error } = await supabase.from("parked_cars").update({ is_staged: next }).eq("id", c.id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    setCars((cur) => cur.map((x) => (x.id === c.id ? { ...x, is_staged: next } : x)));
    toast.success(next ? "Car staged for the customer" : "Staging removed");
  };

  return (
    <div className="min-h-screen bg-surface pb-10 safe-top safe-bottom">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <HuriLogo />
        <div className="flex-1" />
        <TopActions />
        <Link to="/" className="grid h-8 w-8 place-items-center rounded-full text-primary"><ArrowLeft className="h-5 w-5" /></Link>
      </header>

      <div className="p-4">
        <h1 className="mb-1 text-lg font-semibold">Stage a car</h1>
        <p className="mb-3 text-sm text-muted-foreground">
          Staged means the car is finished but the customer has not arrived yet.
        </p>

        {!canStage ? (
          <p className="rounded-2xl bg-background px-4 py-8 text-center text-sm text-muted-foreground">
            Only advisors, managers and directors can stage cars.
          </p>
        ) : (
          <>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              className="mb-3 w-full rounded-xl bg-muted px-3 py-2.5 text-base outline-none placeholder:text-muted-foreground"
            />
            <ul className="overflow-hidden rounded-2xl bg-background">
              {matches.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">No cars found.</li>
              )}
              {matches.map((c) => (
                <li key={c.id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.ro_number ? `RO #${c.ro_number}` : "No RO #"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.car_model ?? "—"} · {c.lot_position === "UNKNOWN" ? "Spot unknown" : `Spot ${c.lot_position}`}
                    </p>
                  </div>
                  <button
                    onClick={() => toggle(c)}
                    disabled={busyId === c.id}
                    aria-pressed={!!c.is_staged}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${
                      c.is_staged ? "bg-success/15 text-success" : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {c.is_staged ? "Staged" : "Stage"}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

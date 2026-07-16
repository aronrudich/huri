import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { HuriLogo, TopActions } from "@/components/BottomBar";
import { toast } from "sonner";
import { isValidSpot } from "@/lib/lot";

type ParkSearch = { ro?: string };

export const Route = createFileRoute("/park")({
  head: () => ({ meta: [{ title: "Park a Car · Huri" }] }),
  validateSearch: (s: Record<string, unknown>): ParkSearch => ({
    ro: typeof s.ro === "string" ? s.ro : undefined,
  }),
  component: ParkPage,
});

function ParkPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { ro: roParam } = Route.useSearch();
  const [ro, setRo] = useState(roParam ?? "");
  const [pos, setPos] = useState("");
  const [model, setModel] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!roParam) return;
    supabase.from("parked_cars").select("*").eq("ro_number", roParam).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setEditing(true);
        setExistingId(data.id);
        setRo(data.ro_number ?? "");
        setModel(data.car_model ?? "");
        setPos(data.lot_position === "UNKNOWN" ? "" : data.lot_position);
        setNotes(data.notes ?? "");
      });
  }, [roParam]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ro.trim()) return toast.error("RO # is required");
    if (!pos.trim()) return toast.error("Spot number is required");
    if (!isValidSpot(pos.trim())) return toast.error("Spot must be 1–147, 0 (off the lot), or C1–C36 (Lot 1)");
    if (!user) return;

    const normalizedPos = pos.trim().toUpperCase();
    // Only enforce uniqueness for designated spots — spot 0 means "off the lot" and can have many cars.
    if (normalizedPos !== "0" && normalizedPos !== "UNKNOWN") {
      const { data: occupant } = await supabase
        .from("parked_cars")
        .select("id, ro_number, car_model")
        .eq("lot_position", normalizedPos)
        .maybeSingle();
      if (occupant && occupant.id !== existingId) {
        const label = occupant.ro_number ? `RO #${occupant.ro_number}` : "another car";
        const model = occupant.car_model ? ` (${occupant.car_model})` : "";
        const ok = window.confirm(
          `Spot ${normalizedPos} already has ${label}${model} parked in it.\n\nConfirm that your car is being parked in Spot ${normalizedPos}? The other car will be removed from that spot.`,
        );
        if (!ok) return;
        // Free the previously listed car from that spot.
        await supabase.from("parked_cars").update({ lot_position: "UNKNOWN" }).eq("id", occupant.id);
      }
    }

    setBusy(true);
    const payload = {
      ro_number: ro.trim(),
      car_model: model.trim() || null,
      lot_position: normalizedPos,
      notes: notes.trim() || null,
      parked_by: user.id,
    };
    const { error } = existingId
      ? await supabase.from("parked_cars").update(payload).eq("id", existingId)
      : await supabase.from("parked_cars").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Car updated" : "Car logged");
    navigate({ to: "/pickup", replace: true });
  };

  return (
    <div className="min-h-screen bg-surface safe-top safe-bottom">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <HuriLogo />
        <div className="flex-1" />
        <TopActions />
        <Link to="/pickup" className="grid h-8 w-8 place-items-center rounded-full text-primary"><ArrowLeft className="h-5 w-5" /></Link>
      </header>

      <form onSubmit={submit} className="space-y-3 p-4">
        <Field label="RO Number" required value={ro} onChange={setRo} />
        <Field label="Spot Number (Lot 2: 0–147, 0 = off the lot · Lot 1: C1–C36)" required value={pos} onChange={setPos} />
        <Field label="Car Model" value={model} onChange={setModel} />
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes (battery dead, key fob broken, …)</label>
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className="w-full resize-none rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary"
          />
        </div>
        <button disabled={busy} className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "Saving…" : editing ? "Save Changes" : "Log Vehicle"}
        </button>
        {editing && existingId && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm("Delete this car from the lot? The spot will be freed.")) return;
              setBusy(true);
              const { error } = await supabase.from("parked_cars").delete().eq("id", existingId);
              setBusy(false);
              if (error) return toast.error(error.message);
              toast.success("Car deleted");
              navigate({ to: "/pickup", replace: true });
            }}
            className="w-full rounded-xl border border-destructive bg-background py-3 text-base font-semibold text-destructive disabled:opacity-60"
          >
            Delete Car
          </button>
        )}
      </form>
    </div>
  );
}

function Field({ label, value, onChange, required, placeholder }:
  { label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}{required && <span className="ml-1 text-primary">(Required)</span>}
      </label>
      <input value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder}
        className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary" />
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { HuriLogo, TopActions } from "@/components/BottomBar";
import { toast } from "sonner";
import { isValidSpot, normalizeSpot } from "@/lib/lot";

type ParkSearch = { ro?: string; id?: string };

export const Route = createFileRoute("/park")({
  head: () => ({ meta: [{ title: "Park a Car · Huri" }] }),
  validateSearch: (s: Record<string, unknown>): ParkSearch => ({
    ro: typeof s.ro === "string" ? s.ro : undefined,
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  component: ParkPage,
});

function ParkPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { ro: roParam, id: idParam } = Route.useSearch();
  const [ro, setRo] = useState(roParam ?? "");
  const [pos, setPos] = useState("");
  const [model, setModel] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);

  useEffect(() => {
    const load = async () => {
      type Row = { id: string; ro_number: string | null; car_model: string | null; lot_position: string; notes: string | null };
      let data: Row | null = null;
      if (idParam) {
        const r = await supabase.from("parked_cars").select("*").eq("id", idParam).maybeSingle();
        data = (r.data as Row | null) ?? null;
      } else if (roParam) {
        const r = await supabase.from("parked_cars").select("*").eq("ro_number", roParam).maybeSingle();
        data = (r.data as Row | null) ?? null;
      }
      if (!data) return;
      setEditing(true);
      setExistingId(data.id);
      setRo(data.ro_number ?? "");
      setModel(data.car_model ?? "");
      setPos(data.lot_position === "UNKNOWN" ? "" : data.lot_position);
      setNotes(data.notes ?? "");
    };
    void load();
  }, [roParam, idParam]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ro.trim()) return toast.error("RO # is required");
    if (!/^\d{6}$/.test(ro.trim())) return toast.error("Invalid RO#");
    if (!pos.trim()) return toast.error("Spot is required");
    if (!isValidSpot(pos.trim())) return toast.error("Spot must be 1–147, C (Lot C), or T (Lot T)");
    if (!user) return;

    const normalizedRo = ro.trim();
    const normalizedPos = normalizeSpot(pos.trim())!;
    const isPlaceholder = normalizedPos === "T" || normalizedPos === "C" || normalizedPos === "UNKNOWN";
    let targetId = existingId;

    // Look up an existing car with this RO (case-insensitive) so we update it rather than create a duplicate.
    const { data: existing } = await supabase
      .from("parked_cars")
      .select("id, lot_position, car_model")
      .ilike("ro_number", normalizedRo)
      .maybeSingle();
    if (existing && existing.id !== existingId) {
      const existingSpot = existing.lot_position?.toUpperCase();
      const bothReal =
        existingSpot && !["T", "C", "UNKNOWN"].includes(existingSpot) &&
        !isPlaceholder && existingSpot !== normalizedPos;
      if (bothReal) {
        const carModel = existing.car_model ? ` (${existing.car_model})` : "";
        const ok = window.confirm(
          `RO #${normalizedRo} is already logged in Spot ${existingSpot}${carModel}.\n\nConfirm that you want to update this RO # to Spot ${normalizedPos}?`,
        );
        if (!ok) return;
      }
      targetId = existing.id;
    } else if (existing) {
      targetId = existing.id;
    }

    // Only enforce uniqueness for numbered spots — C, T, UNKNOWN can have many cars.
    if (!isPlaceholder) {
      const { data: occupant } = await supabase
        .from("parked_cars")
        .select("id, ro_number, car_model")
        .eq("lot_position", normalizedPos)
        .maybeSingle();
      if (occupant && occupant.id !== targetId) {
        const label = occupant.ro_number ? `RO #${occupant.ro_number}` : "another car";
        const carModel = occupant.car_model ? ` (${occupant.car_model})` : "";
        const ok = window.confirm(
          `Spot ${normalizedPos} already has ${label}${carModel} parked in it.\n\nConfirm that your car is being parked in Spot ${normalizedPos}? The other car will be moved to Lot T.`,
        );
        if (!ok) return;
        await supabase.from("parked_cars").update({ lot_position: "T" }).eq("id", occupant.id);
      }
    }

    setBusy(true);
    const payload = {
      ro_number: normalizedRo,
      car_model: model.trim() || null,
      lot_position: normalizedPos,
      notes: notes.trim() || null,
      parked_by: user.id,
    };
    const { error } = targetId
      ? await supabase.from("parked_cars").update(payload).eq("id", targetId)
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
        <Field label="RO Number" required value={ro} onChange={setRo} inputMode="numeric" maxLength={6} />
        <Field
          label="Spot (1–147 for Lot 1, C for Lot C, T for Lot T / bay)"
          required value={pos} onChange={setPos}
        />
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
              navigate({ to: "/lot", replace: true });
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

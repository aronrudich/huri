import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Map as MapIcon, X, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { HuriLogo, TopActions } from "@/components/BottomBar";
import { toast } from "sonner";
import { isValidSpot, normalizeSpot, isCustomSpot, lotOf, spotsForLot, adjacentSpots, blockedSpots, locationLabel } from "@/lib/lot";
import { LocationPicker } from "@/components/LocationPicker";
import { LotMap } from "@/components/LotMap";
import { canStageRole, isTechRole, isSpectatorRole } from "@/lib/roles";
import { CarHistory } from "@/components/CarHistory";
import { format } from "date-fns";

type MapCar = {
  id: string;
  ro_number: string | null;
  car_model: string | null;
  lot_position: string;
  notes: string | null;
  is_staged?: boolean | null;
};

type ParkSearch = { ro?: string; id?: string; spot?: string };

export const Route = createFileRoute("/park")({
  head: () => ({ meta: [{ title: "Park a Car · Huri" }] }),
  validateSearch: (s: Record<string, unknown>): ParkSearch => ({
    ro: typeof s.ro === "string" ? s.ro : undefined,
    id: typeof s.id === "string" ? s.id : undefined,
    spot: typeof s.spot === "string" ? s.spot : undefined,
  }),
  component: ParkPage,
});

function ParkPage() {
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const { ro: roParam, id: idParam, spot: spotParam } = Route.useSearch();
  const [ro, setRo] = useState(roParam ?? "");
  const [pos, setPos] = useState(spotParam ?? "");
  const [model, setModel] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [staged, setStaged] = useState(false);
  // Saved location of the loaded car, used for the SV map snapshot.
  const [savedPos, setSavedPos] = useState<string | null>(null);
  // Wash record for this RO — it stays with the RO forever, wherever the car goes.
  const [washedAt, setWashedAt] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [carsBySpot, setCarsBySpot] = useState<Record<string, MapCar>>({});
  const svSpots = useMemo(() => spotsForLot("sv"), []);

  // Advisors, managers and directors can mark a finished car as staged.
  const role = profile?.role_name ?? "";
  const canStage = canStageRole(role);
  const hideModel = isTechRole(role);
  // Only the SV lot has numbered spots, so only SV cars get a map.
  const mapSpot = savedPos && lotOf(savedPos) === "sv" ? savedPos : null;

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);

  useEffect(() => {
    const load = async () => {
      type Row = { id: string; ro_number: string | null; car_model: string | null; lot_position: string; notes: string | null; is_staged?: boolean | null };
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
      setStaged(!!data.is_staged);
      setSavedPos(data.lot_position ?? null);
    };
    void load();
  }, [roParam, idParam]);

  // Loaded up front: powers both the map overlay and the blocking section.
  useEffect(() => {
    supabase
      .from("parked_cars")
      .select("id, ro_number, car_model, lot_position, notes, is_staged")
      .then(({ data }) => {
        const by: Record<string, MapCar> = {};
        ((data as MapCar[]) ?? []).forEach((c) => {
          if (c.lot_position && c.lot_position !== "UNKNOWN") by[c.lot_position.toUpperCase()] = c;
        });
        setCarsBySpot(by);
      });
  }, [savedPos]);

  // "Washed" is tied to the RO #, so it follows the car through every later move.
  useEffect(() => {
    const target = (ro || roParam || "").trim();
    if (!target) { setWashedAt(null); return; }
    let alive = true;
    supabase
      .from("car_washes")
      .select("washed_at")
      .eq("ro_number", target)
      .maybeSingle()
      .then(({ data }) => { if (alive) setWashedAt((data?.washed_at as string | undefined) ?? null); });
    return () => { alive = false; };
  }, [ro, roParam, savedPos]);



  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ro.trim()) return toast.error("RO # is required");
    if (!/^\d{6}$/.test(ro.trim())) return toast.error("Invalid RO#");
    if (!pos.trim()) return toast.error("Spot is required");
    if (!isValidSpot(pos.trim())) return toast.error("Invalid spot");
    if (!user) return;

    const normalizedRo = ro.trim();
    const normalizedPos = normalizeSpot(pos.trim());
    if (!normalizedPos) return toast.error("Invalid spot");
    const isPlaceholder = normalizedPos === "BL" || normalizedPos === "CP" || normalizedPos === "UNKNOWN" || isCustomSpot(normalizedPos);
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
        existingSpot && !["BL", "CP", "UNKNOWN"].includes(existingSpot) &&
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

    // The write goes through assign_lot_position, which locks the spot and the car row
    // so two valets can't claim the same numbered spot at the same moment. Placeholder
    // locations (BL, CP, UNKNOWN, custom) can still hold many cars.
    setBusy(true);
    const args = {
      _target_id: (targetId ?? null) as string,
      _ro_number: normalizedRo,
      _position: normalizedPos,
      _car_model: model.trim() || null,
      _notes: notes.trim() || null,
      _confirm_displace: false,
    };
    let { data: result, error } = await supabase.rpc("assign_lot_position", {
      ...args,
      _car_model: args._car_model as string,
      _notes: args._notes as string,
    });

    const occupied = (result ?? null) as { status?: string; occupant_ro?: string | null; occupant_model?: string | null } | null;
    if (!error && occupied?.status === "occupied" && !isPlaceholder) {
      setBusy(false);
      const label = occupied.occupant_ro ? `RO #${occupied.occupant_ro}` : "another car";
      const carModel = occupied.occupant_model ? ` (${occupied.occupant_model})` : "";
      const ok = window.confirm(
        `Spot ${normalizedPos} already has ${label}${carModel} parked in it.\n\nConfirm that your car is being parked in Spot ${normalizedPos}? The other car's location will be marked unknown until someone parks it again.`,
      );
      if (!ok) return;
      setBusy(true);
      ({ data: result, error } = await supabase.rpc("assign_lot_position", {
        ...args,
        _car_model: args._car_model as string,
        _notes: args._notes as string,
        _confirm_displace: true,
      }));
    }

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
        {/* Staging is submitted through the pickup form; a staged car shows no
            Stage button here — canceling a stage happens in the pickup list. */}
        <TopActions hideStage={editing && staged} />
        <Link to="/pickup" className="grid h-8 w-8 place-items-center rounded-full text-primary"><ArrowLeft className="h-5 w-5" /></Link>
      </header>

      <form onSubmit={submit} className="space-y-3 p-4">
        <Field label="RO Number" required value={ro} onChange={setRo} inputMode="numeric" maxLength={6} />
        <LocationPicker required value={pos} onChange={setPos} />
        {editing && <BlockingInfo spot={savedPos} carsBySpot={carsBySpot} />}
        {washedAt && (
          <p className="flex items-center gap-1.5 rounded-xl bg-success/10 px-3 py-2 text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" /> Washed · {format(new Date(washedAt), "MMM d, yyyy")}
          </p>
        )}
        {!hideModel && <Field label="Car Model" value={model} onChange={setModel} />}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
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
        {editing && existingId && (
          <div className="flex gap-2 pt-1">
            <Link
              to="/pickup-new"
              search={{ ro: ro.trim() || undefined }}
              className="flex-1 rounded-xl bg-primary py-3 text-center text-base font-semibold text-primary-foreground"
            >
              Pickup
            </Link>
            {canStage && !staged && (
              <Link
                to="/pickup-new"
                search={{ staged: true, ro: ro.trim() || undefined }}
                className="flex-1 rounded-xl bg-primary py-3 text-center text-base font-semibold text-primary-foreground"
              >
                Stage
              </Link>
            )}
            {mapSpot && (
              <button
                type="button"
                onClick={() => setShowMap(true)}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-border bg-background py-3 text-base font-semibold text-foreground active:bg-accent"
              >
                <MapIcon className="h-4 w-4" /> Map
              </button>
            )}
          </div>
        )}
        {editing && existingId && !isSpectatorRole(role) && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm("Mark this car as picked up by the customer? It leaves the lot list the same way a claimed pickup does.")) return;
              if (!user) return;
              setBusy(true);
              const nowIso = new Date().toISOString();
              const { error: reqError } = await supabase.from("pickup_requests").insert({
                ro_number: ro.trim(),
                car_model: model.trim() || null,
                lot_position: savedPos ?? null,
                kind: "pickup",
                status: "completed",
                is_staged: false,
                requested_by: user.id,
                claimed_by: user.id,
                claimed_at: nowIso,
                completed_at: nowIso,
                source_role: role || null,
                advisor_name: profile?.nickname || profile?.full_name || null,
              } as never);
              if (reqError) { setBusy(false); return toast.error(reqError.message); }
              const { error } = await supabase
                .from("parked_cars")
                .update({ lot_position: "UNKNOWN", is_staged: false, flagged_at: null })
                .eq("id", existingId);
              setBusy(false);
              if (error) return toast.error(error.message);
              toast.success("Car marked as picked up");
              navigate({ to: "/pickup", replace: true });
            }}
            className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60"
          >
            Car Has Been Picked Up
          </button>
        )}
        {editing && <CarHistory ro={ro.trim()} />}

      </form>

      {showMap && mapSpot && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 safe-top">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">SV lot map</p>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-primary">{mapSpot}</span> (blue)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowMap(false)}
              aria-label="Close map"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted active:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden px-3 py-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <LotMap spots={svSpots} carsBySpot={carsBySpot} highlightSpot={mapSpot} staticView />
          </div>
        </div>
      )}
    </div>
  );
}

/** Small "who's in the way" panel for the loaded car. SV is the only lot with
 *  numbered, stacked spots, so it's the only lot with real blocking info. */
function BlockingInfo({ spot, carsBySpot }: { spot: string | null; carsBySpot: Record<string, MapCar> }) {
  const normalized = normalizeSpot(spot);
  const isSv = lotOf(normalized) === "sv";
  const blockedBy = isSv
    ? (adjacentSpots(normalized).map((s) => carsBySpot[s]).filter(Boolean) as MapCar[])
    : [];
  const blocking = isSv
    ? (blockedSpots(normalized).map((s) => carsBySpot[s]).filter(Boolean) as MapCar[])
    : [];
  const describe = (c: MapCar) =>
    `${c.lot_position} (${c.ro_number ? `RO #${c.ro_number}` : "no RO"}${c.car_model ? ` · ${c.car_model}` : ""})`;

  return (
    <div className="rounded-xl bg-surface px-3 py-2 text-sm">
      <p>
        <span className="text-muted-foreground">Location:</span>{" "}
        <span className="font-semibold">{locationLabel(normalized)}</span>
      </p>
      {isSv && blockedBy.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Blocked by:</span>{" "}
          {blockedBy.map(describe).join(" and ")}
        </p>
      )}
      {isSv && blocking.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Blocking:</span> {blocking.map(describe).join(" and ")}
        </p>
      )}

    </div>
  );
}

function Field({ label, value, onChange, required, placeholder, inputMode, maxLength }:
  { label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string; inputMode?: "numeric" | "text"; maxLength?: number }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}{required && <span className="ml-1 text-primary">(Required)</span>}
      </label>
      <input value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder}
        inputMode={inputMode} maxLength={maxLength}
        className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary" />
    </div>
  );
}


import { filterRoInput, isValidRo, roDigitLength } from "@/lib/company-configuration";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Map as MapIcon, X, CheckCircle2, Copy, Crosshair, Satellite } from "lucide-react";
import { isGpsAuthorizedEmail } from "@/lib/aron";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { HuriLogo, TopActions } from "@/components/BottomBar";
import { toast } from "sonner";
import { isValidSpot, normalizeSpot, isCustomSpot, lotOf, spotsForLot, adjacentSpots, blockedSpots, locationLabel } from "@/lib/lot";
import { LocationPicker } from "@/components/LocationPicker";
import { LotMap } from "@/components/LotMap";
import { isTechRole, isSpectatorRole } from "@/lib/roles";
import { CarHistory } from "@/components/CarHistory";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dealershipSettingsQuery } from "@/lib/settings";
import { customerArrivalLink } from "@/lib/arrive-link";
import { CarPhotos } from "@/components/CarPhotos";
import { uploadCarPhoto } from "@/lib/car-photos";
import { parkedCarsQuery, pinnedCarsQuery, type ParkedCarRow, type PinnedCarRow } from "@/lib/queries";
import { mergeLoadedCarDetails } from "@/lib/car-loading";
import { useGpsPin } from "@/lib/use-gps-pin";
import { useGpsPinMode } from "@/lib/use-gps-pin-mode";
import type { ManualPin } from "@/lib/manual-pin";
import { Button } from "@/components/ui/button";
import { companyLocationsQuery, occupiedBlockers } from "@/lib/company-locations";

// Leaflet is browser-only: the satellite map loads lazily after hydration.
const SatellitePinMapModal = lazy(() => import("@/components/SatellitePinMapModal"));
const ManualPinMapModal = lazy(() => import("@/components/ManualPinMapModal"));

import { format } from "date-fns";

type MapCar = {
  id: string;
  ro_number: string | null;
  car_model: string | null;
  lot_position: string;
  notes: string | null;
  is_staged?: boolean | null;
};

type ParkSearch = { ro?: string; id?: string; spot?: string; from?: string };

export const Route = createFileRoute("/park")({
  head: () => ({ meta: [
    { title: "Park a Car · Huri" },
    { name: "description", content: "Update a vehicle's current location and parking details." },
    { property: "og:title", content: "Park a Car · Huri" },
    { property: "og:description", content: "Update a vehicle's current location and parking details." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  validateSearch: (s: Record<string, unknown>): ParkSearch => ({
    ro: typeof s.ro === "string" ? s.ro : undefined,
    id: typeof s.id === "string" ? s.id : undefined,
    spot: typeof s.spot === "string" ? s.spot : undefined,
    from: typeof s.from === "string" ? s.from : undefined,
  }),
  component: ParkPage,
});

function ParkPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const { ro: roParam, id: idParam, spot: spotParam, from: fromParam } = Route.useSearch();
  // Cars opened from the Flagged Cars list return there instead of the pickup list.
  const fromFlagged = fromParam === "flagged";
  const goBack = () => navigate({ to: fromFlagged ? "/flagged" : "/pickup", replace: true });
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
  // Which technician's bay this car went to, so "Bay" reads with a name.
  const [bayTech, setBayTech] = useState<string | null>(null);
  // Wash record for this RO — it stays with the RO forever, wherever the car goes.
  const [washedAt, setWashedAt] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const detailEdits = useRef({ model: false, notes: false, pos: !!spotParam });
  const roEdited = useRef(false);
  const formValues = useRef({ model, notes, pos });
  formValues.current = { model, notes, pos };
  const { data: mapCars = [] } = useQuery({ ...parkedCarsQuery(), enabled: !!user });
  const carsBySpot = useMemo(() => {
    const by: Record<string, MapCar> = {};
    mapCars.forEach((c) => {
      if (!["UNKNOWN", "TAKEN"].includes(c.lot_position)) by[c.lot_position.toUpperCase()] = c;
    });
    return by;
  }, [mapCars]);
  const svSpots = useMemo(() => spotsForLot("sv"), []);
  // Photos taken before the car has an RO # / has been saved.
  const pendingPhotos = useRef<File[]>([]);

  const role = profile?.role_name ?? "";
  const { data: settings } = useQuery(dealershipSettingsQuery(profile?.dealership_id));
  const { data: locationRules = [] } = useQuery(companyLocationsQuery(profile?.dealership_id));
  const hideModel = isTechRole(role);
  // Private GPS pin-drop test controls — authorized GPS accounts only.
  const gpsAuthorized = isGpsAuthorizedEmail(user?.email);
  const gps = useGpsPin(!!user && gpsAuthorized && !isSpectatorRole(role));
  const { mode: gpsPinMode } = useGpsPinMode(user?.id);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPin, setManualPin] = useState<ManualPin | null>(null);
  const approximate = useMemo(() => gps.fix ? { latitude: gps.fix.latitude, longitude: gps.fix.longitude } : null, [manualOpen]);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinDrop, setPinDrop] = useState<{ accFt: number; at: string; polished?: boolean } | null>(null);
  const pinContext = useRef({ ro: ro.trim(), pos, companyId: profile?.dealership_id, userId: user?.id, allowed: gpsAuthorized && !isSpectatorRole(role) });
  pinContext.current = { ro: ro.trim(), pos, companyId: profile?.dealership_id, userId: user?.id, allowed: gpsAuthorized && !isSpectatorRole(role) };
  const [satFocus, setSatFocus] = useState<PinnedCarRow | null>(null);
  const { data: pinnedCars = [] } = useQuery({ ...pinnedCarsQuery(), enabled: !!user && gpsAuthorized });
  const pinnedFocus = useMemo(() => {
    const target = ro.trim();
    if (!gpsAuthorized || !target) return null;
    return pinnedCars.find((c) => c.ro_number === target) ?? null;
  }, [gpsAuthorized, pinnedCars, ro]);

  const dropPin = async () => {
    const target = ro.trim();
    const companyId = profile?.dealership_id;
    if (!user || !companyId || !gpsAuthorized || isSpectatorRole(role) || pinBusy) return;
    if (!isValidRo(target, settings?.ro_format)) return toast.error("Enter a valid RO # first");
    if (gpsPinMode === "manual") { gps.cancelPolish(); setManualOpen(true); return; }
    setPinBusy(true);
    gps.cancelPolish();
    try {
        const fix = await gps.acquire();
        if (!gps.isMounted()) return;
        const accFt = Math.round(fix.accuracyFeet);
        const coords = {
          latitude: fix.latitude,
          longitude: fix.longitude,
          accuracy_ft: accFt,
          pinned_at: new Date(fix.timestamp).toISOString(),
        };
          let carId = existingId;
          if (!carId) {
            const { data: found, error: lookupError } = await supabase
              .from("parked_cars").select("id").eq("dealership_id", companyId).eq("ro_number", target).maybeSingle();
            if (lookupError) throw lookupError;
            carId = found?.id ?? null;
          }
          // The existing database trigger records the location audit with the car write.
          // Only independent car/request writes run concurrently; never duplicate that audit.
          const carWrite = carId
            ? supabase.from("parked_cars").update({ ...coords, lot_position: "GPS", parked_by: user.id })
                .eq("dealership_id", companyId).eq("id", carId)
            : supabase.from("parked_cars").insert({
                dealership_id: companyId, ro_number: target, lot_position: "GPS", parked_by: user.id, ...coords,
              } as never);
          const [carResult, requestResult] = await Promise.all([
            carWrite,
            supabase.from("pickup_requests").update(coords).eq("dealership_id", companyId)
              .eq("ro_number", target).in("status", ["unclaimed", "claimed"]),
          ]);
          // Reflect a successful car save even if propagation needs retrying.
          if (!carResult.error && gps.isMounted()) {
            detailEdits.current.pos = true;
            setPos("GPS");
            setSavedPos("GPS");
            setPinDrop({ accFt, at: coords.pinned_at });
          }
          void queryClient.invalidateQueries({ queryKey: ["parked-cars"] });
          void queryClient.invalidateQueries({ queryKey: ["pickups"] });
          void queryClient.invalidateQueries({ queryKey: ["pinned-cars"] });
          if (carResult.error) throw carResult.error;
          // One bounded correction, only while this screen still represents the saved car.
          // Compare-and-set prevents delayed GPS readings overwriting a newer pin/location.
          gps.polish(fix, (improved) => {
            const current = pinContext.current;
            if (!gps.isMounted() || document.hidden || !current.allowed || current.userId !== user.id
              || current.companyId !== companyId || current.ro !== target || normalizeSpot(current.pos) !== "GPS") return;
            const improvedCoords = {
              latitude: improved.latitude, longitude: improved.longitude,
              accuracy_ft: Math.round(improved.accuracyFeet), pinned_at: new Date(improved.timestamp).toISOString(),
            };
            void (async () => {
              const { data: updated, error } = await supabase.from("parked_cars").update(improvedCoords)
                .eq("dealership_id", companyId).eq("ro_number", target).in("lot_position", ["GPS", "GPS PIN"])
                .eq("pinned_at", coords.pinned_at).select("id");
              if (error || !updated?.length) return;
              await supabase.from("pickup_requests").update(improvedCoords).eq("dealership_id", companyId)
                .eq("ro_number", target).eq("pinned_at", coords.pinned_at).in("status", ["unclaimed", "claimed"]);
              if (gps.isMounted() && pinContext.current.ro === target) {
                setPinDrop({ accFt: improvedCoords.accuracy_ft, at: improvedCoords.pinned_at, polished: true });
              }
              void queryClient.invalidateQueries({ queryKey: ["pinned-cars"] });
              void queryClient.invalidateQueries({ queryKey: ["pickups"] });
            })().catch(() => { /* Keep the successfully saved original pin on correction failure. */ });
          });
          if (requestResult.error) throw new Error("Pin saved to the car, but pickup pins could not refresh. Tap Drop GPS Pin to retry.");
          if (!gps.isMounted()) return;
          toast.success(`GPS Pin Dropped: ±${accFt} ft accuracy`);
    } catch (e) {
      if (gps.isMounted()) toast.error((e as Error).message);
    } finally {
      if (gps.isMounted()) setPinBusy(false);
    }
  };
  // Only the SV lot has numbered spots, so only SV cars get a map.
  const mapSpot = savedPos && lotOf(savedPos) === "sv" ? savedPos : null;

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);

  // ID-based editors load that car once; typing a correction must not reload it.
  const lookupRo = idParam ? "" : ro;
  useEffect(() => {
    if (!user) return;
    const targetRo = lookupRo.trim();
    if (!idParam && !isValidRo(targetRo, settings?.ro_format)) return;
    let cancelled = false;
    const apply = (data: ParkedCarRow) => {
      if (cancelled) return;
      const details = mergeLoadedCarDetails(formValues.current, data, detailEdits.current);
      setEditing(true);
      setExistingId(data.id);
      if (idParam && !roEdited.current) setRo(data.ro_number ?? "");
      setModel(details.model);
      setPos(details.pos);
      setNotes(details.notes);
      setStaged(!!data.is_staged);
      setSavedPos(data.lot_position ?? null);
      setBayTech(data.bay_tech ?? null);
    };
    // Paint instantly from the lot list already in memory, then verify live.
    const cached = queryClient.getQueryData<ParkedCarRow[]>(["parked-cars"]);
    const hit = cached?.find((c) => idParam ? c.id === idParam : c.ro_number === targetRo);
    if (hit) apply(hit);
    const load = async () => {
      const request = supabase.from("parked_cars").select("*");
      try {
        const { data, error } = await (idParam ? request.eq("id", idParam) : request.eq("ro_number", targetRo))
          .abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
        if (cancelled) return;
        if (error) throw error;
        if (data) apply(data);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? `${error.name} ${error.message}` : String((error as { message?: string })?.message ?? error);
        if (!idParam && !hit && /timeout|timed out|abort/i.test(message)) return;
        toast.error("Could not load this car's details. Please try again.");
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [lookupRo, idParam, queryClient, user, settings?.ro_format]);

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
    gps.cancelPolish();
    if (!ro.trim()) return toast.error("RO # is required");
    if (!isValidRo(ro, settings?.ro_format)) return toast.error("Invalid RO#");
    if (pinBusy) return;
    if (!pos.trim()) return toast.error("Spot is required");
    if (!isValidSpot(pos.trim())) return toast.error("Invalid spot");
    if (!user) return;

    const normalizedRo = ro.trim();
    const normalizedPos = normalizeSpot(pos.trim());
    if (!normalizedPos) return toast.error("Invalid spot");
    const isPlaceholder = normalizedPos === "BL" || normalizedPos === "CP" || normalizedPos === "UNKNOWN" || normalizedPos === "TAKEN" || isCustomSpot(normalizedPos);
    let targetId = existingId;

    // Look up an existing car with this RO (case-insensitive) so we update it rather than create a duplicate.
    const { data: existing, error: lookupError } = await supabase
      .from("parked_cars")
      .select("id, lot_position, car_model")
      .ilike("ro_number", normalizedRo)
      .maybeSingle();
    if (lookupError) return toast.error("Could not verify this car. Please try again.");
    if (existing && (existing.id !== existingId || (!roParam && !idParam))) {
      const existingSpot = existing.lot_position?.toUpperCase();
      const bothReal =
        existingSpot && !["BL", "CP", "UNKNOWN", "TAKEN"].includes(existingSpot) &&
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
      _notes: detailEdits.current.notes ? notes.trim() : notes.trim() || null,
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

    // Manual modal Save stages the pin only. Assign first so occupied-spot rules
    // and confirmations remain unchanged, then attach coordinates to that car.
    if (manualPin && gpsAuthorized && profile?.dealership_id && normalizeSpot(manualPin.location) === normalizedPos) {
      const coords = { latitude: manualPin.latitude, longitude: manualPin.longitude, accuracy_ft: null, pinned_at: manualPin.pinned_at };
      const { data: saved, error: pinError } = await supabase.from("parked_cars").update(coords)
        .eq("dealership_id", profile.dealership_id).eq("ro_number", normalizedRo).eq("lot_position", normalizedPos).select("id");
      if (pinError || !saved?.length) {
        void queryClient.invalidateQueries({ queryKey: ["parked-cars"] });
        return toast.error("Location saved, but the map pin could not save. Please retry Save.");
      }
      const { error: requestError } = await supabase.from("pickup_requests").update(coords)
        .eq("dealership_id", profile.dealership_id).eq("ro_number", normalizedRo).in("status", ["unclaimed", "claimed"]);
      void queryClient.invalidateQueries({ queryKey: ["pinned-cars"] });
      void queryClient.invalidateQueries({ queryKey: ["pickups"] });
      if (requestError) return toast.error("Car pin saved, but pickup pins could not refresh. Please retry Save.");
    }

    // Attach any photos taken before the car had an RO #.
    if (pendingPhotos.current.length && user) {
      try {
        for (const file of pendingPhotos.current) {
          await uploadCarPhoto(file, normalizedRo, user.id);
        }
        pendingPhotos.current = [];
      } catch {
        toast.error("Car saved, but a photo could not be attached");
      }
    }

    toast.success(editing ? "Car updated" : "Car logged");
    await queryClient.invalidateQueries({ queryKey: ["parked-cars"] });
    goBack();
  };

  if (!user) return <div className="min-h-screen bg-surface" />;
  return (
    <div className="min-h-screen bg-surface safe-top safe-bottom">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <HuriLogo />
        <div className="flex-1" />
        {/* Staging is submitted through the pickup form; a staged car shows no
            Stage button here — canceling a stage happens in the pickup list. */}
        <TopActions hideStage={editing && staged} />
        <Link to={fromFlagged ? "/flagged" : "/pickup"} className="grid h-8 w-8 place-items-center rounded-full text-primary"><ArrowLeft className="h-5 w-5" /></Link>
      </header>

      <form onSubmit={submit} className="space-y-3 p-4">
        <Field label="RO Number" required value={ro} onChange={(raw) => {
          if (pinBusy) return;
          gps.cancelPolish();
          setManualPin(null);
          const value = filterRoInput(raw, settings?.ro_format);
          roEdited.current = true;
          setRo(value);
          // A correction belongs to the same car, including its model/location.
          if (idParam) return;
          setExistingId(null);
          setEditing(false);
          setSavedPos(null);
          setBayTech(null);
          setStaged(false);
          setPinDrop(null);
          if (!detailEdits.current.model) setModel("");
          if (!detailEdits.current.notes) setNotes("");
        }} inputMode="numeric" maxLength={roDigitLength(settings?.ro_format)} />
        <LocationPicker required value={pos} onChange={(value) => { gps.cancelPolish(); setManualPin(null); detailEdits.current.pos = true; setPos(value); }} />
        {gpsAuthorized && !isSpectatorRole(role) && (
          <div className="space-y-2">
            {gpsPinMode === "auto" && gps.active && (
              <p role="status" className={`flex items-center gap-1.5 text-xs ${gps.fix && !gps.error ? "text-success" : "text-warning"}`}>
                <span className={`h-2 w-2 shrink-0 rounded-full ${gps.fix && !gps.error ? "bg-success" : "bg-warning"}`} />
                {gps.error ?? (gps.fix ? `GPS Ready (±${Math.round(gps.fix.accuracyFeet)} ft)` : "Acquiring GPS…")}
              </p>
            )}
            <Button
              type="button"
              onClick={dropPin}
              disabled={pinBusy}
              className="flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold disabled:opacity-100"
            >
              <Crosshair className="h-4 w-4" /> {pinBusy ? gps.refining ? "Acquiring GPS…" : "Saving pin…" : "Drop GPS Pin"}
            </Button>
            {manualPin && <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" />Map pin selected · {manualPin.location === "GPS" ? "Car location" : manualPin.location}</p>}
            {pinDrop && (
              <p className="flex items-center gap-1.5 rounded-xl bg-success/10 px-3 py-2 text-sm font-semibold text-success">
                <CheckCircle2 className="h-4 w-4" /> GPS Pin {pinDrop.polished ? "Polished" : "Dropped"}: ±{pinDrop.accFt} ft accuracy
              </p>
            )}
            {pinnedFocus && (
              <button
                type="button"
                onClick={() => setSatFocus(pinnedFocus)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 text-sm font-semibold text-foreground active:bg-accent"
              >
                <Satellite className="h-4 w-4" /> View on Satellite Map
              </button>
            )}
          </div>
        )}
        {editing && <BlockingInfo spot={savedPos} carsBySpot={carsBySpot} bayTech={bayTech} rules={locationRules} isJcd={settings?.company_code === "JCD29854"} />}
        {washedAt && (
          <p className="flex items-center gap-1.5 rounded-xl bg-success/10 px-3 py-2 text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" /> Washed · {format(new Date(washedAt), "MMM d, yyyy")}
          </p>
        )}
        {!hideModel && <Field label="Car Model" value={model} onChange={(value) => { detailEdits.current.model = true; setModel(value); }} />}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
          <textarea
            value={notes} onChange={(e) => { detailEdits.current.notes = true; setNotes(e.target.value); }} rows={3}
            className="w-full resize-none rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary"
          />
        </div>
        <CarPhotos ro={ro.trim()} userId={user?.id} canEdit={!isSpectatorRole(role)} pendingRef={pendingPhotos} />

        <button disabled={busy} className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "Saving…" : editing ? "Save Changes" : "Save"}
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
              if (fromFlagged) navigate({ to: "/flagged", replace: true });
              else navigate({ to: "/lot", replace: true });
            }}
            className="w-full rounded-xl border border-destructive bg-background py-3 text-base font-semibold text-destructive disabled:opacity-60"
          >
            Delete Car
          </button>
        )}
        {editing && existingId && mapSpot && (
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowMap(true)}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-border bg-background py-3 text-base font-semibold text-foreground active:bg-accent"
            >
              <MapIcon className="h-4 w-4" /> Map
            </button>
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
                // Marked so Reports never count this shortcut as a real submission/claim.
                status: "picked_up",
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
                .update({ lot_position: "TAKEN", is_staged: false, flagged_at: null })
                .eq("id", existingId);
              setBusy(false);
              if (error) return toast.error(error.message);
              toast.success("Car marked as picked up");
              goBack();
            }}
            className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60"
          >
            Car Has Been Picked Up
          </button>
        )}
        {/* Advisors text this to the customer so they can set their own arrival
            time; the car then jumps to the top of the valets' pickup list. */}
        {settings?.slug && isValidRo(ro, settings?.ro_format) && (
          <button
            type="button"
            onClick={async () => {
              const link = customerArrivalLink(settings.slug, ro.trim());
              try {
                await navigator.clipboard.writeText(link);
                toast.success("Customer link copied");
              } catch {
                toast.message(link);
              }
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-input bg-background py-3 text-sm font-semibold text-primary"
          >
            <Copy className="h-4 w-4" /> Copy Customer ETA Link
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
                Current location: <span className="font-semibold">{mapSpot}</span>
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
            <LotMap spots={svSpots} carsBySpot={carsBySpot} staticView />
          </div>
        </div>
      )}

      {/* Only reachable from a tap, so the lazy Leaflet bundle never loads during SSR. */}
      {gpsAuthorized && !isSpectatorRole(role) && manualOpen && (
        <Suspense fallback={<div role="status" className="fixed inset-0 z-[70] grid place-items-center bg-background">Loading map…</div>}>
          <ManualPinMapModal companyCode={settings?.company_code} approximate={approximate} initial={manualPin} onClose={() => setManualOpen(false)} onSave={(pin) => {
            gps.cancelPolish(); detailEdits.current.pos = true; setPos(pin.location); setManualPin(pin); setPinDrop(null); setManualOpen(false);
          }} />
        </Suspense>
      )}
      {gpsAuthorized && satFocus && (
        <Suspense fallback={null}>
          <SatellitePinMapModal focus={satFocus} others={pinnedCars} onClose={() => setSatFocus(null)} />
        </Suspense>
      )}
    </div>
  );
}

/** Small "who's in the way" panel for the loaded car. SV is the only lot with
 *  numbered, stacked spots, so it's the only lot with real blocking info. */
function BlockingInfo({ spot, carsBySpot, bayTech, rules, isJcd }: { spot: string | null; carsBySpot: Record<string, MapCar>; bayTech?: string | null; rules: import("@/lib/company-locations").LocationRule[]; isJcd: boolean }) {
  const normalized = normalizeSpot(spot);
  const isSv = isJcd ? lotOf(normalized) === "sv" : rules.some((r) => r.label === normalized);
  const blockedBy = occupiedBlockers(normalized, rules, isJcd, carsBySpot);
  const blocking = isJcd && isSv
    ? (blockedSpots(normalized).map((s) => carsBySpot[s]).filter(Boolean) as MapCar[])
    : Object.values(carsBySpot).filter((car) => occupiedBlockers(car.lot_position, rules, isJcd, carsBySpot).some((blocker) => blocker.lot_position === normalized));
  const describe = (c: MapCar) =>
    `${c.lot_position} (${c.ro_number ? `RO #${c.ro_number}` : "no RO"}${c.car_model ? ` · ${c.car_model}` : ""})`;

  if (normalized === "TAKEN" || (!blockedBy.length && !blocking.length && !(normalized === "BAY" && bayTech))) return null;
  return (
    <div className="rounded-xl bg-surface px-3 py-2 text-sm">
      {normalized === "BAY" && bayTech && (
        <p>
          <span className="text-muted-foreground">Location:</span>{" "}
          <span className="font-semibold">{locationLabel(normalized, bayTech)}</span>
        </p>
      )}
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


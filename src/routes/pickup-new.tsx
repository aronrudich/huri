import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { HuriLogo, TopActions } from "@/components/BottomBar";
import { toast } from "sonner";
import { useSuspended } from "@/lib/suspension";
import { sendPickupAlert } from "@/lib/push.functions";
import { isTechRole } from "@/lib/roles";

type PickupNewSearch = { staged?: boolean; ro?: string };

export const Route = createFileRoute("/pickup-new")({
  head: () => ({ meta: [{ title: "New Pickup · Huri" }] }),
  validateSearch: (s: Record<string, unknown>): PickupNewSearch => ({
    staged: s.staged === true || s.staged === "true" ? true : undefined,
    ro: typeof s.ro === "string" ? s.ro : undefined,
  }),
  component: NewPickupPage,
});

function NewPickupPage() {
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const suspended = useSuspended();
  const { staged, ro: roParam } = Route.useSearch();
  const isStage = !!staged;
  const [ro, setRo] = useState(roParam ?? "");
  const [model, setModel] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);

  const advisorName = profile?.nickname || profile?.full_name || "";
  // Techs never type the model — it is already tied to the RO.
  const hideModel = isTechRole(profile?.role_name);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ro.trim()) return toast.error("RO # is required");
    if (!/^\d{6}$/.test(ro.trim())) return toast.error("Invalid RO#");
    if (!user) return;
    if (suspended) {
      toast.success(isStage ? "Stage submitted" : "Pickup submitted");
      navigate({ to: "/pickup", replace: true });
      return;
    }
    setBusy(true);
    const sourceRole = profile?.role_name ?? null;
    // Snapshot the car's current spot + notes so valets can still find it after the spot is freed on claim.
    const { data: car } = await supabase
      .from("parked_cars")
      .select("lot_position, car_model, notes, is_staged")
      .eq("ro_number", ro.trim())
      .maybeSingle();
    const noteText = notes.trim();
    const { error } = await supabase.from("pickup_requests").insert({
      ro_number: ro.trim(),
      advisor_name: advisorName || null,
      car_model: model.trim() || car?.car_model || null,
      requested_by: user.id,
      source_role: sourceRole,
      lot_position: car?.lot_position ?? null,
      car_notes: noteText || car?.notes || null,
      is_staged: isStage,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    // Staging flags the car so its map spot shows the checkered pattern; a real
    // pickup on an already-staged car clears that flag instead.
    if (car) {
      const patch: { is_staged?: boolean; notes?: string } = {};
      if (isStage) patch.is_staged = true;
      else if (car.is_staged) patch.is_staged = false;
      if (noteText) patch.notes = noteText;
      if (Object.keys(patch).length) {
        supabase.from("parked_cars").update(patch).eq("ro_number", ro.trim()).then();
      }
    }
    // Valets are notified for every submission type, stages included.
    sendPickupAlert({
      data: {
        tag: null,
        ro: ro.trim(),
        advisor: advisorName || null,
        model: model.trim() || null,
        sourceRole,
        staged: isStage,
      },
    }).catch((e) => console.warn("push fan-out failed", e));
    toast.success(isStage ? "Stage submitted" : "Pickup submitted");
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
        <h1 className="text-lg font-semibold">{isStage ? "Stage Car" : "New Pickup"}</h1>
        {isStage && (
          <p className="text-sm text-muted-foreground">
            Staged means the car is finished but the customer has not arrived yet. Valets are notified, but staged cars sit below every other request until claimed.
          </p>
        )}
        <Field label="RO Number" required value={ro} onChange={setRo} autoFocus inputMode="numeric" maxLength={6} />
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{profile?.role_name || "Submitted by"}</label>
          <input
            value={advisorName}
            disabled
            className="w-full rounded-xl border border-input bg-muted px-3 py-3 text-base text-muted-foreground"
          />
        </div>
        {!hideModel && <Field label="Car Model" value={model} onChange={setModel} />}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            
            className="w-full resize-none rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary"
          />
        </div>
        <button disabled={busy} className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "Submitting…" : isStage ? "Submit Stage" : "Submit Request"}
        </button>
      </form>

    </div>
  );
}

function Field({ label, value, onChange, required, autoFocus, inputMode, maxLength }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; autoFocus?: boolean; inputMode?: "numeric" | "text"; maxLength?: number }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}{required && <span className="ml-1 text-primary">(Required)</span>}
      </label>
      <input value={value} onChange={(e) => onChange(e.target.value)} required={required} autoFocus={autoFocus}
        inputMode={inputMode} maxLength={maxLength}
        className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary" />
    </div>
  );
}


import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { HuriLogo, TopActions } from "@/components/BottomBar";
import { toast } from "sonner";
import { sendPickupAlert } from "@/lib/push.functions";

export const Route = createFileRoute("/pickup-new")({
  head: () => ({ meta: [{ title: "New Pickup · Huri" }] }),
  component: NewPickupPage,
});

function NewPickupPage() {
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const [ro, setRo] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);

  const advisorName = profile?.nickname || profile?.full_name || "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ro.trim()) return toast.error("RO # is required");
    if (!/^\d{6}$/.test(ro.trim())) return toast.error("Invalid RO#");
    if (!user) return;
    setBusy(true);
    const sourceRole = profile?.role_name ?? null;
    // Snapshot the car's current spot + notes so valets can still find it after the spot is freed on claim.
    const { data: car } = await supabase
      .from("parked_cars")
      .select("lot_position, car_model, notes")
      .eq("ro_number", ro.trim())
      .maybeSingle();
    const { error } = await supabase.from("pickup_requests").insert({
      ro_number: ro.trim(),
      advisor_name: advisorName || null,
      car_model: model.trim() || car?.car_model || null,
      requested_by: user.id,
      source_role: sourceRole,
      lot_position: car?.lot_position ?? null,
      car_notes: car?.notes ?? null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    sendPickupAlert({
      data: {
        tag: null,
        ro: ro.trim(),
        advisor: advisorName || null,
        model: model.trim() || null,
        sourceRole,
      },
    }).catch((e) => console.warn("push fan-out failed", e));
    toast.success("Pickup submitted");
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
        <Field label="RO Number" required value={ro} onChange={setRo} autoFocus inputMode="numeric" maxLength={6} />
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Advisor</label>
          <input
            value={advisorName}
            disabled
            className="w-full rounded-xl border border-input bg-muted px-3 py-3 text-base text-muted-foreground"
          />
        </div>
        <Field label="Car Model" value={model} onChange={setModel} />
        <button disabled={busy} className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "Submitting…" : "Submit Request"}
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


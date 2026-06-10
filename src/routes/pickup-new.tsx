import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/pickup-new")({
  head: () => ({ meta: [{ title: "New Pickup · Huri" }] }),
  component: NewPickupPage,
});

function NewPickupPage() {
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const [ro, setRo] = useState("");
  const [tag, setTag] = useState("");
  const [advisor, setAdvisor] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);
  useEffect(() => { if (profile && !advisor) setAdvisor(profile.full_name); /* prefill */ }, [profile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ro.trim() && !tag.trim() && !advisor.trim() && !model.trim()) {
      return toast.error("Fill at least one field");
    }
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("pickup_requests").insert({
      ro_number: ro.trim() || null,
      tag_number: tag.trim() || null,
      advisor_name: advisor.trim() || null,
      car_model: model.trim() || null,
      requested_by: user.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Pickup submitted");
    navigate({ to: "/pickup", replace: true });
  };

  return (
    <div className="min-h-screen bg-surface safe-top safe-bottom">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Link to="/pickup" className="grid h-8 w-8 place-items-center rounded-full text-primary"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="flex-1 text-center text-base font-semibold">Submit Pickup Request</h1>
        <div className="w-8" />
      </header>

      <form onSubmit={submit} className="space-y-3 p-4">
        <p className="rounded-xl bg-accent/40 px-3 py-2 text-xs text-accent-foreground">
          All fields optional — any single field is enough. Huri matches against parked cars by Tag# or RO#.
        </p>
        <Field label="RO Number" value={ro} onChange={setRo} />
        <Field label="Tag Number" value={tag} onChange={setTag} />
        <Field label="Advisor Name" value={advisor} onChange={setAdvisor} />
        <Field label="Car Model" value={model} onChange={setModel} />
        <button disabled={busy} className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "Submitting…" : "Submit Request"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary" />
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { HuriLogo } from "@/components/BottomBar";
import { toast } from "sonner";
import { sendPickupAlert } from "@/lib/push.functions";

export const Route = createFileRoute("/pickup-new")({
  head: () => ({ meta: [{ title: "New Pickup · Huri" }] }),
  component: NewPickupPage,
});

function NewPickupPage() {
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const [tag, setTag] = useState("");
  const [ro, setRo] = useState("");
  const [advisor, setAdvisor] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);
  useEffect(() => { if (profile && !advisor) setAdvisor(profile.full_name); }, [profile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tag.trim()) return toast.error("Tag # is required");
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("pickup_requests").insert({
      tag_number: tag.trim(),
      ro_number: ro.trim() || null,
      advisor_name: advisor.trim() || null,
      car_model: model.trim() || null,
      requested_by: user.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    // Fan-out web push to valets (fire & forget; don't block UX)
    sendPickupAlert({
      data: {
        tag: tag.trim() || null,
        ro: ro.trim() || null,
        advisor: advisor.trim() || null,
        model: model.trim() || null,
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
        <Link to="/pickup" className="grid h-8 w-8 place-items-center rounded-full text-primary"><ArrowLeft className="h-5 w-5" /></Link>
      </header>

      <form onSubmit={submit} className="space-y-3 p-4">
        <Field label="Tag Number" required value={tag} onChange={setTag} />
        <Field label="RO Number" value={ro} onChange={setRo} />
        <Field label="Advisor Name" value={advisor} onChange={setAdvisor} />
        <Field label="Car Model" value={model} onChange={setModel} />
        <button disabled={busy} className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "Submitting…" : "Submit Request"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}{required && <span className="ml-1 text-primary">(Required)</span>}
      </label>
      <input value={value} onChange={(e) => onChange(e.target.value)} required={required}
        className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary" />
    </div>
  );
}

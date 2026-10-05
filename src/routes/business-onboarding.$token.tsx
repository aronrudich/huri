import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { openOnboarding, saveOnboardingDraft } from "@/lib/onboarding.functions";
import huriLogo from "@/assets/huri-logo-new.png.asset.json";

export const Route = createFileRoute("/business-onboarding/$token")({
  head: () => ({
    meta: [
      { title: "Set up your business · Huri" },
      { name: "description", content: "Securely set up your business and property map in Huri." },
      { property: "og:title", content: "Set up your business · Huri" },
      { property: "og:description", content: "Securely set up your business and property map in Huri." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  ssr: false,
  component: OnboardingPage,
});

type Draft = {
  businessName?: string; businessType?: "dealership" | "auction"; contactEmail?: string;
  contactName?: string; contactPhone?: string; notes?: string;
};

function OnboardingPage() {
  const { token } = Route.useParams();
  const open = useServerFn(openOnboarding);
  const save = useServerFn(saveOnboardingDraft);
  const { data, isLoading } = useQuery({ queryKey: ["onboarding", token], queryFn: () => open({ data: { token } }), retry: false, staleTime: Infinity });
  const [form, setForm] = useState<Draft>({});
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (!data?.valid) return;
    const d = (data.draft?.data ?? {}) as Draft;
    setForm({
      businessName: d.businessName ?? data.inquiry.businessName,
      businessType: d.businessType ?? (data.inquiry.businessType as Draft["businessType"]),
      contactEmail: d.contactEmail ?? data.inquiry.email,
      contactName: d.contactName ?? "", contactPhone: d.contactPhone ?? "", notes: d.notes ?? "",
    });
    if (data.draft?.current_step && data.draft.current_step > 1) setStep(2);
  }, [data]);

  const set = (k: keyof Draft) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const saveStep = async (next: number) => {
    if (!form.businessName?.trim()) return toast.error("Business name is required");
    setBusy(true);
    try {
      const r = await save({ data: { token, step: next, data: form } });
      setSavedAt(r.savedAt);
      setStep(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-surface safe-top safe-bottom">
      <div className="mx-auto max-w-md px-5 py-10">
        <img src={huriLogo.url} alt="Huri" className="mx-auto mb-6 h-10 w-auto" />
        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground">Opening your setup…</p>
        ) : !data?.valid ? (
          <div className="rounded-2xl bg-card p-6 text-center shadow-sm">
            <h1 className="text-lg font-bold">This link isn't active</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              It may have expired or been replaced. Contact Huri and we'll send you a new one.
            </p>
          </div>
        ) : step === 1 ? (
          <div className="rounded-2xl bg-card p-6 shadow-sm">
            <p className="text-xs font-medium text-primary">Step 1 · Business</p>
            <h1 className="mt-1 text-xl font-bold">Confirm your business</h1>
            <p className="mt-1 text-xs text-muted-foreground">No password or personal account is needed.</p>
            <div className="mt-5 space-y-3">
              <Input label="Business Name" value={form.businessName ?? ""} onChange={set("businessName")} max={160} />
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Business Type</label>
                <div className="flex gap-2">
                  {(["dealership", "auction"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, businessType: t }))}
                      className={`flex-1 rounded-xl border py-3 text-sm font-medium ${form.businessType === t ? "border-primary bg-primary/10 text-primary" : "border-input bg-background"}`}>
                      {t === "dealership" ? "Dealership" : "Auction"}
                    </button>
                  ))}
                </div>
              </div>
              <Input label="Contact Email" value={form.contactEmail ?? ""} onChange={set("contactEmail")} max={254} type="email" />
              <Input label="Contact Name (optional)" value={form.contactName ?? ""} onChange={set("contactName")} max={120} />
              <Input label="Phone (optional)" value={form.contactPhone ?? ""} onChange={set("contactPhone")} max={40} type="tel" />
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Additional notes (optional)</label>
                <textarea value={form.notes ?? ""} onChange={(e) => set("notes")(e.target.value.slice(0, 3000))} rows={3}
                  className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary" />
              </div>
              <button disabled={busy} onClick={() => saveStep(2)}
                className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60">
                {busy ? "Saving…" : "Save & Continue"}
              </button>
              {savedAt && <p className="text-center text-[11px] text-muted-foreground">Saved</p>}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-card p-6 text-center shadow-sm">
            <p className="text-xs font-medium text-primary">Step 2 · Property map</p>
            <h1 className="mt-1 text-xl font-bold">Your details are saved</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Map setup for your address, property, and lots will open here soon. You can come back to this same link anytime.
            </p>
            <button onClick={() => setStep(1)} className="mt-5 w-full rounded-xl bg-muted py-3 text-sm font-medium">Edit business details</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, max, type = "text" }: { label: string; value: string; onChange: (v: string) => void; max: number; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input value={value} type={type} onChange={(e) => onChange(e.target.value.slice(0, max))}
        className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary" />
    </div>
  );
}

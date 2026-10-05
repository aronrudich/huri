import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { openOnboarding, saveOnboardingDraft, submitOnboarding } from "@/lib/onboarding.functions";
import type { Draft } from "@/lib/onboarding-schema";
import { AddressLookup } from "@/components/AddressLookup";
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

const STEPS = ["Business", "Address", "Review"];
const DONE = 4;
const addrOk = (d: Draft) => !!(d.address?.street?.trim() && (d.address.city?.trim() || d.address.zip?.trim()));

function OnboardingPage() {
  const { token } = Route.useParams();
  const open = useServerFn(openOnboarding);
  const save = useServerFn(saveOnboardingDraft);
  const submit = useServerFn(submitOnboarding);
  const { data, isLoading } = useQuery({ queryKey: ["onboarding", token], queryFn: () => open({ data: { token } }), retry: false, staleTime: Infinity });
  const [form, setForm] = useState<Draft>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [step, setStep] = useState(1);
  const [locked, setLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dirty = useRef(false);
  const stepRef = useRef(1);
  stepRef.current = step;

  useEffect(() => {
    if (!data?.valid) return;
    const d = (data.draft?.data ?? {}) as Draft;
    setForm({
      ...d,
      businessName: d.businessName ?? data.inquiry.businessName,
      businessType: d.businessType ?? (data.inquiry.businessType as Draft["businessType"]),
      contactEmail: d.contactEmail ?? data.inquiry.email,
    });
    const st = data.draft?.status;
    if (st === "submitted" || st === "approved" || st === "activated") { setLocked(true); setStep(DONE); }
    else if (data.draft?.current_step) setStep(Math.min(3, Math.max(1, data.draft.current_step)));
    setLoaded(true);
  }, [data]);

  const set = useCallback((fn: (d: Draft) => Draft) => { dirty.current = true; setForm(fn); }, []);

  // Autosave ~1.2s after the last edit.
  useEffect(() => {
    if (!loaded || locked || !dirty.current) return;
    const t = setTimeout(async () => {
      dirty.current = false;
      setSaving("saving");
      try { await save({ data: { token, step: stepRef.current, data: form } }); setSaving("saved"); }
      catch (e) { setSaving("error"); toast.error(e instanceof Error ? e.message : "Could not save"); }
    }, 1200);
    return () => clearTimeout(t);
  }, [form, loaded, locked, save, token]);

  const go = async (next: number) => {
    if (step === 1 && !form.businessName?.trim()) return toast.error("Business name is required");
    if (step === 2 && next === 3 && !addrOk(form)) return toast.error("Please enter your business address");
    setSaving("saving");
    try { await save({ data: { token, step: next, data: form } }); dirty.current = false; setSaving("saved"); setStep(next); window.scrollTo(0, 0); }
    catch (e) { setSaving("error"); toast.error(e instanceof Error ? e.message : "Could not save"); }
  };

  const doSubmit = async () => {
    if (!form.businessName?.trim()) { toast.error("Business name is required"); return setStep(1); }
    if (!addrOk(form)) { toast.error("Please enter your business address"); return setStep(2); }
    setSubmitting(true);
    try { await submit({ data: { token, data: form } }); setLocked(true); setStep(DONE); window.scrollTo(0, 0); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not submit. Please try again."); }
    finally { setSubmitting(false); }
  };

  const wide = false;
  return (
    <div className="min-h-screen bg-surface safe-top safe-bottom">
      <div className={`mx-auto px-4 py-8 ${wide ? "max-w-3xl" : "max-w-md"}`}>
        <img src={huriLogo.url} alt="Huri" className="mx-auto mb-5 h-10 w-auto" />
        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground">Opening your setup…</p>
        ) : !data?.valid ? (
          <div className="rounded-2xl bg-card p-6 text-center shadow-sm">
            <h1 className="text-lg font-bold">This link isn't active</h1>
            <p className="mt-2 text-sm text-muted-foreground">It may have expired, been replaced, or your setup is already complete. Contact Huri and we'll help.</p>
          </div>
        ) : step === DONE ? (
          <div className="rounded-2xl bg-card p-6 text-center shadow-sm">
            <h1 className="text-xl font-bold">Thank you!</h1>
            <p className="mt-3 text-sm">We've got your details. Huri will be in touch to finish setting up your property map with you.</p>
            <p className="mt-3 text-sm text-muted-foreground">Once your setup is approved, Huri will create your company and provide the company code you'll use to create employee accounts.</p>
          </div>
        ) : (
          <>
            <ol className="mb-4 flex gap-1 overflow-x-auto pb-1 text-[11px]">
              {STEPS.map((s, i) => (
                <li key={s} className={`shrink-0 rounded-full px-2.5 py-1 ${step === i + 1 ? "bg-primary text-primary-foreground" : i + 1 < step ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {i + 1}. {s}
                </li>
              ))}
            </ol>
            {data.draft?.status === "changes_requested" && data.draft.review_message && (
              <div className="mb-3 rounded-2xl border border-warning bg-warning/10 p-3 text-sm">
                <p className="font-semibold">Huri asked for a few changes</p>
                <p className="mt-1 whitespace-pre-wrap">{data.draft.review_message}</p>
              </div>
            )}
            <div className="rounded-2xl bg-card p-4 shadow-sm sm:p-6">
              <div className="mb-3 flex items-center justify-between">
                <h1 className="text-lg font-bold">{["Confirm your business", "Business address", "Review & submit"][step - 1]}</h1>
                <span className="text-[11px] text-muted-foreground">{saving === "saving" ? "Saving…" : saving === "saved" ? "Saved" : saving === "error" ? "Not saved" : ""}</span>
              </div>
              {step === 1 && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">No password or personal account is needed.</p>
                  <Input label="Business Name" value={form.businessName ?? ""} onChange={(v) => set((f) => ({ ...f, businessName: v }))} max={160} />
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Business Type</label>
                    <div className="flex gap-2">
                      {(["dealership", "auction"] as const).map((t) => (
                        <button key={t} type="button" onClick={() => set((f) => ({ ...f, businessType: t }))}
                          className={`flex-1 rounded-xl border py-3 text-sm font-medium ${form.businessType === t ? "border-primary bg-primary/10 text-primary" : "border-input bg-background"}`}>
                          {t === "dealership" ? "Dealership" : "Auction"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Input label="Contact Email" value={form.contactEmail ?? ""} onChange={(v) => set((f) => ({ ...f, contactEmail: v }))} max={254} type="email" />
                  <Input label="Contact Name (optional)" value={form.contactName ?? ""} onChange={(v) => set((f) => ({ ...f, contactName: v }))} max={120} />
                  <Input label="Phone (optional)" value={form.contactPhone ?? ""} onChange={(v) => set((f) => ({ ...f, contactPhone: v }))} max={40} type="tel" />
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Additional notes (optional)</label>
                    <textarea value={form.notes ?? ""} onChange={(e) => set((f) => ({ ...f, notes: e.target.value.slice(0, 3000) }))} rows={3}
                      className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary" />
                  </div>
                </div>
              )}
              {step === 2 && <AddressLookup draft={form} set={set} />}
              {step === 3 && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-border p-3 text-sm">
                    <div className="flex justify-between"><p className="font-semibold">Business</p><button onClick={() => setStep(1)} className="text-xs text-primary">Edit</button></div>
                    <p>{form.businessName}</p>
                    <p className="text-muted-foreground">{form.businessType === "auction" ? "Auction" : "Dealership"} · {form.contactEmail}</p>
                    {(form.contactName || form.contactPhone) && <p className="text-muted-foreground">{[form.contactName, form.contactPhone].filter(Boolean).join(" · ")}</p>}
                    {form.notes && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{form.notes}</p>}
                  </div>
                  <div className="rounded-xl border border-border p-3 text-sm">
                    <div className="flex justify-between"><p className="font-semibold">Address</p><button onClick={() => setStep(2)} className="text-xs text-primary">Edit</button></div>
                    <p>{form.address?.street}</p>
                    <p>{[form.address?.city, form.address?.state, form.address?.zip].filter(Boolean).join(", ")}</p>
                    {form.address?.country && <p>{form.address.country}</p>}
                    {form.address?.notes && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{form.address.notes}</p>}
                  </div>
                  <p className="rounded-xl bg-muted p-3 text-sm">Huri will contact you to set up your property map together. Your company and employee accounts will not be created until Huri approves the setup.</p>
                  <button disabled={submitting} onClick={doSubmit} className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60">
                    {submitting ? "Submitting…" : "Submit to Huri"}
                  </button>
                </div>
              )}
              <div className="mt-5 flex gap-2">
                {step > 1 && <button onClick={() => go(step - 1)} className="flex-1 rounded-xl bg-muted py-3 text-sm font-medium">Back</button>}
                {step < 3 && (
                  <button onClick={() => go(step + 1)}
                    className="flex-[2] rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-50">
                    Save & Continue
                  </button>
                )}
              </div>
            </div>
          </>
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Copy } from "lucide-react";
import { toast } from "sonner";
import { getHelpIdentity } from "@/lib/help.functions";
import {
  activateOnboardingCompany, approveOnboardingMap, getOnboardingReview, requestOnboardingChanges,
  saveReviewDraft, saveReviewerNotes, sendActivationEmail,
} from "@/lib/onboarding.functions";
import type { Draft } from "@/lib/onboarding-schema";
import { AddressSection, BarcodeSection, LotsSection, PropertySection, ReviewSummary, RowsSpotsSection } from "@/components/OnboardingSections";

export const Route = createFileRoute("/business-onboarding-review/$inquiryId")({
  head: () => ({
    meta: [
      { title: "Review Property Map · Huri Support" },
      { name: "description", content: "Huri Support review of a business's submitted property map." },
      { property: "og:title", content: "Review Property Map · Huri Support" },
      { property: "og:description", content: "Huri Support review of a business's submitted property map." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  ssr: false,
  component: ReviewPage,
});

const TABS = ["Overview", "Address", "Property", "Lots", "Rows & Spots"] as const;
const DRAFT_LABEL: Record<string, string> = { draft: "In progress", submitted: "Submitted", changes_requested: "Changes requested", approved: "Map approved", activated: "Company created" };

function ReviewPage() {
  const { inquiryId } = Route.useParams();
  const identity = useServerFn(getHelpIdentity);
  const load = useServerFn(getOnboardingReview);
  const saveFn = useServerFn(saveReviewDraft);
  const notesFn = useServerFn(saveReviewerNotes);
  const changesFn = useServerFn(requestOnboardingChanges);
  const approveFn = useServerFn(approveOnboardingMap);
  const activateFn = useServerFn(activateOnboardingCompany);
  const emailFn = useServerFn(sendActivationEmail);
  const qc = useQueryClient();
  const { data: who, isLoading: whoLoading } = useQuery({ queryKey: ["help-identity"], queryFn: () => identity() });
  const { data, isLoading } = useQuery({ queryKey: ["onboarding-review", inquiryId], enabled: !!who?.isSupport, queryFn: () => load({ data: { inquiryId } }) });
  const [form, setForm] = useState<Draft>({});
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [notes, setNotes] = useState("");
  const [changeMsg, setChangeMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [created, setCreated] = useState<{ name: string; code: string; businessType: string; activatedAt?: string } | null>(null);

  useEffect(() => {
    if (!data) return;
    setForm((data.draft?.data ?? {}) as Draft);
    setNotes(data.draft?.reviewer_notes ?? "");
    setEmailTo(((data.draft?.data as Draft | undefined)?.contactEmail) || data.inquiry.email);
    setDirty(false);
  }, [data]);

  const set = useCallback((fn: (d: Draft) => Draft) => { setForm(fn); setDirty(true); }, []);
  const refresh = () => qc.invalidateQueries({ queryKey: ["onboarding-review", inquiryId] });
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  };

  if (whoLoading) return null;
  if (!who?.isSupport) return <p className="p-6 text-center text-sm text-muted-foreground">This area is only for Huri support.</p>;
  if (isLoading || !data) return <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>;

  const st = data.draft?.status ?? "none";
  const activated = !!data.inquiry.company_id;
  const company = created ?? data.company;
  const ro = activated;

  return (
    <div className="min-h-screen bg-surface safe-top safe-bottom">
      <header className="sticky top-0 z-[600] flex items-center gap-3 border-b border-border bg-background px-4 py-3">
        <Link to="/business-onboarding-admin" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full active:bg-accent"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="flex-1 truncate text-center text-base font-semibold">{data.inquiry.business_name}</h1>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{DRAFT_LABEL[st] ?? "Not started"}</span>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 p-3">
        <section className="rounded-2xl bg-card p-4 text-sm shadow-sm">
          <p><b>{data.inquiry.business_type === "auction" ? "Auction" : "Dealership"}</b> · {data.inquiry.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Inquiry {new Date(data.inquiry.created_at).toLocaleDateString()} · Submitted {data.draft?.submitted_at ? new Date(data.draft.submitted_at).toLocaleString() : "—"}
            {" "}· Link {data.link ? (data.link.revoked_at ? "off" : new Date(data.link.expires_at) < new Date() ? "expired" : `active, last opened ${data.link.last_opened_at ? new Date(data.link.last_opened_at).toLocaleString() : "never"}`) : "none"}
          </p>
          {data.inquiry.message && <p className="mt-2 whitespace-pre-wrap text-xs">{data.inquiry.message}</p>}
        </section>

        {company && (
          <section className="rounded-2xl border border-success bg-success/10 p-4 shadow-sm">
            <p className="text-xs font-semibold text-success">Company created</p>
            <p className="mt-1 font-semibold">{company.name} · {company.businessType === "auction" ? "Auction" : "Dealership"}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="font-mono text-2xl font-bold tracking-widest">{company.code}</span>
              <button onClick={() => { navigator.clipboard.writeText(company.code); toast.success("Code copied"); }} className="rounded-full bg-background p-2" aria-label="Copy code"><Copy className="h-4 w-4" /></button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Activated {new Date(created?.activatedAt ?? data.inquiry.activated_at ?? Date.now()).toLocaleString()}{data.inquiry.activation_emailed_at ? ` · Code last emailed ${new Date(data.inquiry.activation_emailed_at).toLocaleString()}` : ""}</p>
            <div className="mt-3 flex gap-2">
              <input value={emailTo} onChange={(e) => setEmailTo(e.target.value.slice(0, 254))} className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm" />
              <button disabled={busy} onClick={() => confirm(`Email code ${company.code} to ${emailTo}?`) && run(() => emailFn({ data: { inquiryId, email: emailTo } }), "Activation email sent")}
                className="rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                {data.inquiry.activation_emailed_at ? "Send again" : "Send activation email"}
              </button>
            </div>
          </section>
        )}

        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{t}</button>)}
        </div>
        <section className="rounded-2xl bg-card p-4 shadow-sm">
          {!data.draft ? <p className="text-sm text-muted-foreground">The business hasn't started mapping yet.</p> : (
            <>
              {tab === "Overview" && <ReviewSummary draft={form} onEdit={ro ? undefined : (s) => setTab(TABS[Math.min(4, s - 1)] ?? "Overview")} />}
              {tab === "Address" && <AddressSection draft={form} set={set} readOnly={ro} />}
              {tab === "Property" && <PropertySection draft={form} set={set} readOnly={ro} />}
              {tab === "Lots" && <LotsSection draft={form} set={set} readOnly={ro} />}
              {tab === "Rows & Spots" && <div className="space-y-4"><RowsSpotsSection draft={form} set={set} readOnly={ro} />{form.businessType === "auction" && <BarcodeSection draft={form} set={set} readOnly={ro} />}</div>}
              {!ro && (
                <button disabled={!dirty || busy} onClick={() => run(() => saveFn({ data: { inquiryId, data: form, section: tab.toLowerCase() } }), "Map changes saved")}
                  className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  {dirty ? "Save map changes" : "No unsaved changes"}
                </button>
              )}
            </>
          )}
        </section>

        {data.draft && (
          <section className="space-y-3 rounded-2xl bg-card p-4 shadow-sm">
            <div>
              <p className="mb-1 text-xs font-semibold">Internal reviewer notes</p>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 5000))} rows={3} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
              <button disabled={busy} onClick={() => run(() => notesFn({ data: { inquiryId, notes } }), "Notes saved")} className="mt-1 rounded-full bg-muted px-3 py-1.5 text-xs font-medium">Save notes</button>
            </div>
            {!activated && (
              <>
                <div>
                  <p className="mb-1 text-xs font-semibold">Return to business for changes</p>
                  <textarea value={changeMsg} onChange={(e) => setChangeMsg(e.target.value.slice(0, 3000))} rows={3} placeholder="What should they fix? They'll see this when they open their link."
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
                  <button disabled={busy || !changeMsg.trim() || dirty}
                    onClick={() => confirm("Send back for changes? This emails a fresh secure link and turns off the old one.") && run(async () => { await changesFn({ data: { inquiryId, message: changeMsg } }); setChangeMsg(""); }, "Sent back for changes")}
                    className="mt-1 rounded-full bg-warning px-3 py-1.5 text-xs font-semibold text-warning-foreground disabled:opacity-50">Request changes</button>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  {st !== "approved" && (
                    <button disabled={busy || dirty || !["submitted", "changes_requested"].includes(st)} onClick={() => run(() => approveFn({ data: { inquiryId } }), "Map approved")}
                      className="rounded-full bg-success px-4 py-2 text-xs font-semibold text-success-foreground disabled:opacity-50">Mark map approved</button>
                  )}
                  {st === "approved" && (
                    <button disabled={busy || dirty} onClick={async () => {
                      if (!confirm("This creates the company's Huri workspace and permanent company code. The business will receive the code only after creation. This cannot be undone automatically.")) return;
                      setBusy(true);
                      try { const r = await activateFn({ data: { inquiryId } }); setCreated(r); toast.success(r.already ? "Company was already created" : "Company created"); refresh(); }
                      catch (e) { toast.error(e instanceof Error ? e.message : "Could not create the company"); }
                      finally { setBusy(false); }
                    }} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Approve and Create Company</button>
                  )}
                </div>
                {dirty && <p className="text-[11px] text-warning">Save your map changes first.</p>}
              </>
            )}
          </section>
        )}

        {data.activity.length > 0 && (
          <section className="rounded-2xl bg-card p-4 shadow-sm">
            <p className="mb-2 text-xs font-semibold">Activity</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {data.activity.map((a) => {
                const s = a.summary as { after?: { lots: number; spots: number } };
                return <li key={a.id}>{new Date(a.created_at).toLocaleString()} · {a.actor_label} · {a.section.replace(/_/g, " ")}{s?.after ? ` (${s.after.lots} lots, ${s.after.spots} spots)` : ""}</li>;
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

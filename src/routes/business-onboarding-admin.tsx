import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getHelpIdentity } from "@/lib/help.functions";
import { setInquiryStatus } from "@/lib/business.functions";
import { listOnboardingLinks, createOnboardingLink, revokeOnboardingLink } from "@/lib/onboarding.functions";

export const Route = createFileRoute("/business-onboarding-admin")({
  head: () => ({
    meta: [
      { title: "Business Onboarding · Huri" },
      { name: "description", content: "Review new business inquiries for Huri." },
      { property: "og:title", content: "Business Onboarding · Huri" },
      { property: "og:description", content: "Review new business inquiries for Huri." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: BusinessAdmin,
});

const STATUS_LABEL: Record<string, string> = {
  new: "New", contacted: "Contacted", onboarding_sent: "Onboarding sent", onboarding_started: "Onboarding started",
  submitted_for_review: "Ready for review", approved: "Approved", declined: "Declined",
};

function BusinessAdmin() {
  const identity = useServerFn(getHelpIdentity);
  const setStatus = useServerFn(setInquiryStatus);
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const listLinks = useServerFn(listOnboardingLinks);
  const createLink = useServerFn(createOnboardingLink);
  const revokeLink = useServerFn(revokeOnboardingLink);
  const [freshUrl, setFreshUrl] = useState<Record<string, string>>({});
  const [linkBusy, setLinkBusy] = useState(false);
  const { data: who, isLoading: whoLoading } = useQuery({ queryKey: ["help-identity"], queryFn: () => identity() });
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["business-inquiries"],
    enabled: !!who?.isSupport,
    queryFn: async () => {
      const { data, error } = await supabase.from("business_inquiries")
        .select("id, email, business_name, business_type, message, status, created_at, email_notification_sent_at, email_notification_error")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: linkData } = useQuery({ queryKey: ["onboarding-links"], enabled: !!who?.isSupport, queryFn: () => listLinks() });
  const activeLink = (id: string) => linkData?.links.find((l) => l.inquiry_id === id && !l.revoked_at && new Date(l.expires_at) > new Date());
  const draftFor = (id: string) => linkData?.drafts.find((d) => d.inquiry_id === id);

  const makeLink = async (id: string, sendEmail: boolean) => {
    if (activeLink(id) && !confirm("This replaces the current link. The old link will stop working. Continue?")) return;
    setLinkBusy(true);
    try {
      const r = await createLink({ data: { inquiryId: id, sendEmail } });
      setFreshUrl((m) => ({ ...m, [id]: r.url }));
      if (sendEmail) r.emailed ? toast.success("Onboarding email sent") : toast.error(r.emailError ?? "Email not sent");
      else toast.success("Link created — copy it now");
      qc.invalidateQueries({ queryKey: ["onboarding-links"] });
      qc.invalidateQueries({ queryKey: ["business-inquiries"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not create link"); }
    finally { setLinkBusy(false); }
  };
  const revoke = async (id: string) => {
    if (!confirm("Turn off this link? The business won't be able to use it.")) return;
    await revokeLink({ data: { inquiryId: id } });
    setFreshUrl((m) => { const n = { ...m }; delete n[id]; return n; });
    qc.invalidateQueries({ queryKey: ["onboarding-links"] });
    toast.success("Link turned off");
  };

  const update = async (id: string, status: string) => {
    try {
      await setStatus({ data: { id, status: status as "contacted" } });
      qc.invalidateQueries({ queryKey: ["business-inquiries"] });
      toast.success("Updated");
    } catch { toast.error("Could not update"); }
  };

  return (
    <div className="min-h-screen bg-surface safe-top safe-bottom">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background px-4 py-3">
        <Link to="/profile" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full active:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">Business Onboarding</h1>
        <span className="w-9" />
      </header>

      <main className="mx-auto max-w-2xl p-3">
        {whoLoading ? null : !who?.isSupport ? (
          <p className="p-6 text-center text-sm text-muted-foreground">This area is only for Huri support.</p>
        ) : isLoading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No business inquiries yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const open = openId === r.id;
              return (
                <li key={r.id} className="rounded-2xl bg-card p-4 shadow-sm">
                  <button className="w-full text-left" onClick={() => setOpenId(open ? null : r.id)}>
                    <div className="flex items-center gap-2">
                      {r.status === "new" && <span className="h-2 w-2 rounded-full bg-primary" aria-label="New" />}
                      <span className="flex-1 font-semibold">{r.business_name}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{STATUS_LABEL[r.status] ?? r.status}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {r.business_type === "auction" ? "Auction" : "Dealership"} · {r.email} · {new Date(r.created_at).toLocaleString()}
                    </div>
                    {!open && r.message && <p className="mt-2 line-clamp-2 text-sm">{r.message}</p>}
                  </button>
                  {open && (
                    <div className="mt-3 space-y-3">
                      <p className="whitespace-pre-wrap text-sm">{r.message || "No message."}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Email alert: {r.email_notification_sent_at ? "sent" : r.email_notification_error ? "failed to send" : "pending"}
                      </p>
                      <OnboardingLinkPanel
                        link={activeLink(r.id)}
                        draft={draftFor(r.id)}
                        freshUrl={freshUrl[r.id]}
                        busy={linkBusy}
                        closed={r.status === "approved" || r.status === "declined"}
                        onCreate={(send) => makeLink(r.id, send)}
                        onRevoke={() => revoke(r.id)}
                      />
                      <div className="flex flex-wrap gap-2">
                        <a href={`mailto:${r.email}`} className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Email them</a>
                        {r.status !== "contacted" && <button onClick={() => update(r.id, "contacted")} className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium">Mark contacted</button>}
                        {r.status !== "declined" && <button onClick={() => update(r.id, "declined")} className="rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive">Decline</button>}
                        {r.status === "declined" && <button onClick={() => update(r.id, "new")} className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium">Reopen</button>}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

type LinkRow = { expires_at: string; first_opened_at: string | null; last_opened_at: string | null; emailed_at: string | null; created_at: string };
type DraftRow = { status: string; current_step: number; updated_at: string; submitted_at: string | null };

function OnboardingLinkPanel({ link, draft, freshUrl, busy, closed, onCreate, onRevoke }: {
  link?: LinkRow; draft?: DraftRow; freshUrl?: string; busy: boolean; closed: boolean;
  onCreate: (sendEmail: boolean) => void; onRevoke: () => void;
}) {
  const d = (s: string | null) => (s ? new Date(s).toLocaleString() : "—");
  return (
    <div className="rounded-xl bg-muted/60 p-3 text-xs">
      <p className="font-semibold">Onboarding link</p>
      {link ? (
        <div className="mt-1 space-y-0.5 text-muted-foreground">
          <p>Active · expires {new Date(link.expires_at).toLocaleDateString()}</p>
          <p>Emailed: {d(link.emailed_at)} · Opened: {d(link.last_opened_at)}</p>
          {draft && <p>Progress: {draft.status === "submitted" ? "submitted for review" : `step ${draft.current_step}`} · saved {d(draft.updated_at)}</p>}
        </div>
      ) : (
        <p className="mt-1 text-muted-foreground">{closed ? "Inquiry is closed." : "No active link."}</p>
      )}
      {freshUrl && (
        <div className="mt-2 flex items-center gap-2">
          <input readOnly value={freshUrl} className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2 py-1.5 text-[11px]" />
          <button onClick={() => { navigator.clipboard.writeText(freshUrl); toast.success("Copied"); }}
            className="rounded-full bg-primary px-3 py-1.5 font-semibold text-primary-foreground">Copy</button>
        </div>
      )}
      {freshUrl && <p className="mt-1 text-[11px] text-muted-foreground">For security, this link is shown only now. Make a new one if you lose it.</p>}
      {!closed && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => onCreate(true)} className="rounded-full bg-primary px-3 py-1.5 font-semibold text-primary-foreground disabled:opacity-60">
            {link ? "Send new link by email" : "Send onboarding email"}
          </button>
          <button disabled={busy} onClick={() => onCreate(false)} className="rounded-full bg-background px-3 py-1.5 font-medium disabled:opacity-60">
            {link ? "Make new link to copy" : "Make link to copy"}
          </button>
          {link && <button onClick={onRevoke} className="rounded-full bg-destructive/10 px-3 py-1.5 font-medium text-destructive">Turn off link</button>}
        </div>
      )}
    </div>
  );
}

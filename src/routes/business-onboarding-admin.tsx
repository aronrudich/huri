import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getHelpIdentity } from "@/lib/help.functions";
import { setInquiryStatus } from "@/lib/business.functions";

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

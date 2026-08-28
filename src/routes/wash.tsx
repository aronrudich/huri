// "Wash" = ask a valet to find the car and bring it to the car wash.
// The car wash employee sets the car's next location when the wash is done,
// which is what stamps the car as washed.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { HuriLogo, TopActions } from "@/components/BottomBar";
import { toast } from "sonner";
import { useSuspended } from "@/lib/suspension";
import { sendPickupAlert } from "@/lib/push.functions";

export const Route = createFileRoute("/wash")({
  head: () => ({
    meta: [
      { title: "Request A Wash · Huri" },
      { name: "description", content: "Ask a valet to bring a car to the car wash." },
      { property: "og:title", content: "Request A Wash · Huri" },
      { property: "og:description", content: "Ask a valet to bring a car to the car wash." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WashRequestPage,
});

function WashRequestPage() {
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const suspended = useSuspended();
  const [ro, setRo] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);

  const requesterName = profile?.nickname || profile?.full_name || "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!ro.trim()) return toast.error("RO # is required");
    if (!/^\d{6}$/.test(ro.trim())) return toast.error("Invalid RO#");
    if (suspended) {
      toast.success("Wash request sent");
      navigate({ to: "/pickup", replace: true });
      return;
    }
    setBusy(true);
    const sourceRole = profile?.role_name ?? null;
    const { error } = await supabase.from("pickup_requests").insert({
      kind: "wash",
      ro_number: ro.trim(),
      advisor_name: requesterName || null,
      car_notes: notes.trim() || null,
      requested_by: user.id,
      source_role: sourceRole,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    sendPickupAlert({
      data: {
        tag: null,
        ro: ro.trim(),
        advisor: requesterName || null,
        sourceRole,
        kind: "wash",
      },
    }).catch((err) => console.warn("push fan-out failed", err));
    toast.success("Wash request sent");
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
        <h1 className="text-lg font-semibold">Request A Wash</h1>
        <p className="text-sm text-muted-foreground">
          A valet finds this car and brings it to the wash. The car wash employee sets its
          new location when the wash is done.
        </p>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            RO Number<span className="ml-1 text-primary">(Required)</span>
          </label>
          <input
            value={ro}
            onChange={(e) => setRo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            maxLength={6}
            autoFocus
            className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary"
          />
        </div>
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
          {busy ? "Sending…" : "Submit Wash Request"}
        </button>
      </form>
    </div>
  );
}

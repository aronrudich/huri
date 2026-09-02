import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { HuriLogo, TopActions } from "@/components/BottomBar";
import { toast } from "sonner";
import { submitPickupRequest } from "@/lib/pickup.functions";

export const Route = createFileRoute("/parts")({
  head: () => ({ meta: [{ title: "Request Parts · Huri" }] }),
  component: PartsPage,
});

function PartsPage() {
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [ro, setRo] = useState("");
  const [notes, setNotes] = useState("");
  const submitPickup = useServerFn(submitPickupRequest);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);

  const techName = profile?.nickname || profile?.full_name || "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (ro.trim() && !/^\d{6}$/.test(ro.trim())) return toast.error("Invalid RO#");
    setBusy(true);
    try {
      await submitPickup({ data: {
        kind: "parts",
        advisor: techName || null,
        ro: ro.trim() || null,
        notes: notes.trim() || null,
        sourceRole: profile?.role_name ?? null,
      } });
      toast.success("Parts request sent");
      navigate({ to: "/pickup", replace: true });
    } catch (err) {
      toast.error((err as Error).message || "Failed to send request");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface safe-top safe-bottom">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <HuriLogo />
        <div className="flex-1" />
        <TopActions />
        <Link to="/pickup" className="grid h-8 w-8 place-items-center rounded-full text-primary"><ArrowLeft className="h-5 w-5" /></Link>
      </header>

      <form onSubmit={submit} className="space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          Tap submit to alert the parts valet to bring parts to your bay. Your name will be attached to the request.
        </p>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Requested by</label>
          <input
            value={techName}
            disabled
            className="w-full rounded-xl border border-input bg-muted px-3 py-3 text-base text-muted-foreground"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">RO Number</label>
          <input value={ro} onChange={(event) => setRo(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="w-full resize-none rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary" />
        </div>
        <button
          disabled={busy}
          className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Sending…" : "Submit"}
        </button>
      </form>
    </div>
  );
}

// "Park" = ask a valet to come to the bay and park the technician's car.
// This is NOT the same as "New" (/park), which only logs a car into the system.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { HuriLogo, TopActions } from "@/components/BottomBar";
import { toast } from "sonner";
import { submitPickupRequest } from "@/lib/pickup.functions";

export const Route = createFileRoute("/park-request")({
  head: () => ({
    meta: [
      { title: "Request A Park · Huri" },
      { name: "description", content: "Ask a valet to come to your bay and park a car." },
      { property: "og:title", content: "Request A Park · Huri" },
      { property: "og:description", content: "Ask a valet to come to your bay and park a car." },
    ],
  }),
  component: ParkRequestPage,
});

function ParkRequestPage() {
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const [ro, setRo] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const submitPickup = useServerFn(submitPickupRequest);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);

  const requesterName = profile?.nickname || profile?.full_name || "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!ro.trim()) return toast.error("RO # is required");
    if (!/^\d{6}$/.test(ro.trim())) return toast.error("Invalid RO#");
    setBusy(true);
    const sourceRole = profile?.role_name ?? null;
    try {
      await submitPickup({ data: {
        ro: ro.trim(),
        advisor: requesterName || null,
        notes: notes.trim() || null,
        sourceRole,
        kind: "park",
        lotPosition: "BAY",
      } });
      toast.success("Park request sent");
      navigate({ to: "/pickup", replace: true });
    } catch (error) {
      toast.error((error as Error).message || "Failed to send request");
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

      <form onSubmit={submit} className="space-y-3 p-4">
        <h1 className="text-lg font-semibold">Request A Park</h1>
        <p className="text-sm text-muted-foreground">
          A valet is notified to come to your bay and park this car for you.
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
          {busy ? "Sending…" : "Submit Park Request"}
        </button>
      </form>
    </div>
  );
}

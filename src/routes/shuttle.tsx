import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { HuriLogo, TopActions } from "@/components/BottomBar";
import { toast } from "sonner";
import { sendShuttleAlert } from "@/lib/push.functions";

export const Route = createFileRoute("/shuttle")({
  head: () => ({
    meta: [
      { title: "Shuttle Request · Huri" },
      { name: "description", content: "Request a shuttle for a customer at the dealership." },
      { property: "og:title", content: "Shuttle Request · Huri" },
      { property: "og:description", content: "Request a shuttle for a customer at the dealership." },
    ],
  }),
  component: ShuttlePage,
});

function ShuttlePage() {
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const [kind, setKind] = useState<"pickup" | "dropoff">("pickup");
  const [address, setAddress] = useState("");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [ro, setRo] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);

  const requesterName = profile?.nickname || profile?.full_name || "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    // Nothing is required on a shuttle request.
    const digits = phone.replace(/\D/g, "");
    setBusy(true);
    try {
      await sendShuttleAlert({
        data: {
          customerName: customer.trim() || null,
          customerPhone: digits || null,
          shuttleKind: kind,
          address: kind === "pickup" ? address.trim() || null : null,
          ro: ro.trim() || null,
          notes: notes.trim() || null,
          requesterName: requesterName || null,
        },
      });
      toast.success("Shuttle request sent");
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

      <form onSubmit={submit} className="space-y-3 p-4">
        <h1 className="text-lg font-semibold">Shuttle Request</h1>
        <p className="text-sm text-muted-foreground">The shuttle drivers are notified right away.</p>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Type</label>
          <div className="flex gap-2">
            {([["pickup", "Pickup"], ["dropoff", "Drop Off"]] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setKind(id)}
                className={`flex-1 rounded-xl border py-3 text-base font-semibold ${
                  kind === id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {kind === "pickup" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Pickup Address</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Customer Name
          </label>
          <input
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            autoFocus
            className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Phone Number
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">RO Number</label>
          <input
            value={ro}
            onChange={(e) => setRo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            maxLength={6}
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
          {busy ? "Sending…" : "Submit Shuttle Request"}
        </button>
      </form>
    </div>
  );
}

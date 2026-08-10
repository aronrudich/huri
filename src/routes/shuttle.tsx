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
    if (!customer.trim()) return toast.error("Customer name is required");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return toast.error("Enter a valid phone number");
    if (ro.trim() && !/^\d{6}$/.test(ro.trim())) return toast.error("Invalid RO#");
    setBusy(true);
    try {
      await sendShuttleAlert({
        data: {
          customerName: customer.trim(),
          customerPhone: digits,
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
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Customer Name<span className="ml-1 text-primary">(Required)</span>
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
            Phone Number<span className="ml-1 text-primary">(Required)</span>
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import huriLogo from "@/assets/huri-logo-compressed.png.asset.json";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password · Huri" },
      { name: "description", content: "Create a new password for your Huri account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [resendEmail, setResendEmail] = useState("");

  useEffect(() => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      setReady(ok ? "ok" : "invalid");
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish(true);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish(true);
      else window.setTimeout(() => finish(false), 2500);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return toast.error("Enter a new password");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut();
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the password");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    const email = resendEmail.trim().toLowerCase();
    if (!email) return toast.error("Enter your email");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success("New link sent — check your email");
  };

  return (
    <div className="min-h-screen bg-surface safe-top safe-bottom">
      <div className="mx-auto max-w-md px-5 py-12">
        <div className="mb-8 text-center">
          <img src={huriLogo.url} alt="Huri" className="mx-auto mb-3 h-14 w-auto" />
          <p className="mt-1 text-sm text-muted-foreground">Lot Management</p>
        </div>

        <div className="rounded-2xl bg-card p-6 shadow-sm">
          {ready === "checking" && (
            <p className="text-center text-sm text-muted-foreground">Checking your link…</p>
          )}

          {ready === "invalid" && !done && (
            <div className="space-y-3">
              <h1 className="text-lg font-semibold">This link has expired</h1>
              <p className="text-sm text-muted-foreground">
                Enter your email and we'll send a new password reset link.
              </p>
              <input
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={resend}
                className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground"
              >
                Send new link
              </button>
              <p className="text-center text-xs text-muted-foreground">
                <Link to="/auth" className="text-primary">Back to sign in</Link>
              </p>
            </div>
          )}

          {ready === "ok" && !done && (
            <form onSubmit={save} className="space-y-3">
              <h1 className="text-lg font-semibold">Set a new password</h1>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  New password
                </label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary"
                />
              </div>
              <button
                disabled={busy}
                className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save Password"}
              </button>
            </form>
          )}

          {done && (
            <div className="space-y-2 text-center">
              <h1 className="text-lg font-semibold">Password saved</h1>
              <p className="text-sm text-muted-foreground">
                Close Huri, open it again, and sign in with your new password.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

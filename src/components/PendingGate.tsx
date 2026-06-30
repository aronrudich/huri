import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function PendingGate() {
  const { user, profile, refreshProfile } = useAuth();
  const pending = !!user && profile?.status === "pending";

  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => { refreshProfile(); }, 5000);
    return () => clearInterval(t);
  }, [pending, refreshProfile]);

  if (!pending) return null;

  const logout = async () => { await supabase.auth.signOut(); };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm safe-top safe-bottom">
      <div className="w-full max-w-sm rounded-3xl bg-background p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-3xl">⏳</div>
        <h2 className="text-2xl font-semibold tracking-tight">Waiting for approval</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Your account was created. The dealership owner needs to approve you before you can use Huri.
          You'll get in automatically the moment you're approved.
        </p>
        <button
          onClick={() => { refreshProfile(); toast.message("Checking…"); }}
          className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
        >
          Check status
        </button>
        <button onClick={logout} className="mt-2 w-full rounded-xl bg-muted py-3 text-sm font-medium text-muted-foreground">
          Sign out
        </button>
      </div>
    </div>
  );
}

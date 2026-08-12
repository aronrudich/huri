import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  full_name: string;
  nickname: string | null;
  email: string;
  phone_number?: string | null;
  avatar_url?: string | null;
  role_id: string | null;
  role_name: string;
  is_active?: boolean;
  deactivated_at?: string | null;
  deactivated_by?: string | null;
  is_owner?: boolean;
  status?: "pending" | "approved";
  pending_role_name?: string | null;
  dealership_id?: string | null;
};

type Ctx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const { data: existing } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (existing) {
      setProfile(existing as Profile);
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData.user;
    if (!authUser) { setProfile(null); return; }

    const fallbackName =
      (authUser.user_metadata?.full_name as string | undefined)?.trim() ||
      authUser.email?.split("@")[0] ||
      "Huri teammate";
    const { data: created } = await supabase
      .from("profiles")
      .upsert(
        {
          id: uid,
          full_name: fallbackName,
          nickname: null,
          email: authUser.email ?? "",
          role_id: null,
          role_name: "Advisor",
          is_active: true,
        },
        { onConflict: "id" },
      )
      .select("*")
      .maybeSingle();
    setProfile((created as Profile) ?? null);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
      }
    });

    // A stale/corrupt stored session makes getSession() retry a token refresh
    // that can never succeed, which used to leave the whole app stuck on the
    // loading screen (seen on desktop browsers with an old token). Give it a
    // few seconds, then drop the local session so the sign-in screen shows.
    let settled = false;
    let watchdog: ReturnType<typeof setTimeout>;
    const finish = () => { if (!settled) { settled = true; clearTimeout(watchdog); setLoading(false); } };
    watchdog = setTimeout(() => {
      if (settled) return;
      void supabase.auth.signOut({ scope: "local" }).catch(() => {});
      setSession(null);
      setProfile(null);
      finish();
    }, 6000);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        if (data.session?.user) loadProfile(data.session.user.id).finally(finish);
        else finish();
      })
      .catch(() => finish());

    return () => { clearTimeout(watchdog); sub.subscription.unsubscribe(); };
  }, []);

  return (
    <AuthCtx.Provider
      value={{
        user: session?.user ?? null,
        session,
        profile,
        loading,
        refreshProfile: async () => {
          if (session?.user) await loadProfile(session.user.id);
        },
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

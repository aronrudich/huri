import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearPersistedQueryCache } from "@/lib/query-persist";

export type Profile = {
  id: string;
  full_name: string;
  nickname: string | null;
  email: string;
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

const PROFILE_CACHE_KEY = "huri.profile.cache.v1";

const readCachedProfile = (uid: string): Profile | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Profile;
    return parsed?.id === uid ? parsed : null;
  } catch {
    return null;
  }
};

const writeCachedProfile = (profile: Profile | null) => {
  if (typeof window === "undefined") return;
  try {
    if (profile) window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    else window.localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // Private-mode browsers can refuse storage; the app still works without the cache.
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const applyProfile = (next: Profile | null) => {
    setProfile(next);
    writeCachedProfile(next);
  };

  const loadProfile = async (uid: string) => {
    const { data: existing } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (existing) {
      applyProfile(existing as Profile);
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData.user;
    if (!authUser) { applyProfile(null); return; }

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
    applyProfile((created as Profile) ?? null);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        // Must stay deferred: calling another supabase client method from
        // inside the auth-state callback deadlocks the client's internal lock,
        // so the profile fetch is pushed to the next macrotask.
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        applyProfile(null);
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
      clearPersistedQueryCache();
      void supabase.auth.signOut({ scope: "local" }).catch(() => {});
      setSession(null);
      applyProfile(null);
      finish();
    }, 6000);

    const signOutLocally = async () => {
      clearPersistedQueryCache();
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      setSession(null);
      applyProfile(null);
      finish();
    };

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!data.session) {
          setSession(null);
          applyProfile(null);
          finish();
          return;
        }

        // Paint immediately from the stored session plus the cached profile,
        // then verify the user and refresh the profile in the background.
        setSession(data.session);
        const cached = readCachedProfile(data.session.user.id);
        if (cached) setProfile(cached);
        finish();

        void loadProfile(data.session.user.id).catch(() => {});
        void supabase.auth.getUser().then(({ data: verified, error }) => {
          if (error || !verified.user) void signOutLocally();
        }).catch(() => {});
      })
      .catch(() => { void signOutLocally(); });

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

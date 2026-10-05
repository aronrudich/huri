import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const AVATAR_PREFIX = "/api/public/avatar/";
const cache = new Map<string, Promise<string | null>>();

/** Profile photos require a signed-in coworker, so fetch them with the session token. */
function loadAvatar(url: string): Promise<string | null> {
  let p = cache.get(url);
  if (!p) {
    p = (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return null;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      return URL.createObjectURL(await res.blob());
    })().catch(() => null);
    p.then((v) => { if (!v) cache.delete(url); });
    cache.set(url, p);
  }
  return p;
}

export function useAvatarSrc(url?: string | null): string | null {
  const needsFetch = !!url && url.startsWith(AVATAR_PREFIX);
  const [src, setSrc] = useState<string | null>(needsFetch ? null : url ?? null);
  useEffect(() => {
    if (!url) { setSrc(null); return; }
    if (!url.startsWith(AVATAR_PREFIX)) { setSrc(url); return; }
    let alive = true;
    setSrc(null);
    void loadAvatar(url).then((v) => { if (alive) setSrc(v); });
    return () => { alive = false; };
  }, [url]);
  return src;
}

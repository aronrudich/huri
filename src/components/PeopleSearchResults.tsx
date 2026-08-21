import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { messageRecipientsQuery } from "@/lib/queries";
import { Avatar, AvatarViewer } from "@/components/Avatar";

/** People results for the shared search bar — available on every tab. */
export function PeopleSearchResults({ q }: { q: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null);

  const { data: people = [], error } = useQuery({ ...messageRecipientsQuery(), enabled: !!user });

  useEffect(() => {
    if (error) console.warn("[search] failed to load message recipients", error);
  }, [error]);

  const hits = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return people
      .filter((p) =>
        (p.nickname ?? "").toLowerCase().includes(n) ||
        (p.fullName ?? "").toLowerCase().includes(n) ||
        (p.roleName ?? "").toLowerCase().includes(n),
      )
      .slice(0, 8);
  }, [people, q]);

  if (hits.length === 0) return null;

  const openThread = (personId: string) => {
    if (!user) return;
    const ids = [user.id, personId].sort();
    navigate({ to: "/thread/$threadId", params: { threadId: `dm:${ids[0]}:${ids[1]}` } });
  };

  return (
    <div className="mx-3 mb-3 overflow-hidden rounded-2xl bg-background">
      <h2 className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        People
      </h2>
      <ul>
        {hits.map((p) => {
          const name = p.nickname || p.fullName || "Unnamed";
          return (
            <li key={p.id} className="flex items-center border-b border-border last:border-b-0">
              <button
                onClick={() => openThread(p.id)}
                className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left active:bg-accent"
              >
                <Avatar url={p.avatarUrl} name={name} size={36} onExpand={(url, n) => setPhoto({ url, name: n })} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.roleName ?? ""}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {photo && <AvatarViewer url={photo.url} name={photo.name} onClose={() => setPhoto(null)} />}
    </div>

  );
}

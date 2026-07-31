import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getMessageRecipients } from "@/lib/directory.functions";
import { formatPhone } from "@/lib/phone";
import { Avatar, AvatarViewer } from "@/components/Avatar";

type Person = {
  id: string;
  fullName: string | null;
  nickname: string | null;
  roleName: string | null;
  phoneNumber: string | null;
  avatarUrl?: string | null;
};


/** People results for the shared search bar — available on every tab. */
export function PeopleSearchResults({ q }: { q: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null);


  useEffect(() => {
    if (!user) return;
    getMessageRecipients()
      .then((rows) => setPeople((rows ?? []) as Person[]))
      .catch(() => setPeople([]));
  }, [user]);

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
                    {[p.roleName, p.phoneNumber ? formatPhone(p.phoneNumber) : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </button>
              {p.phoneNumber && (
                <a
                  href={`tel:${p.phoneNumber}`}
                  aria-label={`Call ${name}`}
                  className="grid h-10 w-12 place-items-center text-primary"
                >
                  <Phone className="h-5 w-5" />
                </a>
              )}
            </li>
          );
        })}
      </ul>
      {photo && <AvatarViewer url={photo.url} name={photo.name} onClose={() => setPhoto(null)} />}
    </div>

  );
}

import { useEffect, useState } from "react";
import { X, Phone, MessageSquare } from "lucide-react";
import { getPublicProfile } from "@/lib/directory.functions";
import { formatPhone, isSyntheticEmail } from "@/lib/phone";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

type Profile = {
  id: string;
  fullName: string;
  nickname: string | null;
  roleName: string;
  phoneNumber: string | null;
  email: string;
  dealershipName: string | null;
};

export function ProfileViewSheet({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPublicProfile({ data: { userId } })
      .then((p) => { if (!cancelled) setProfile(p as Profile | null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  const displayName = profile?.nickname || profile?.fullName || "Unknown";
  const initials = displayName[0]?.toUpperCase() ?? "?";
  const showEmail = profile?.email && !isSyntheticEmail(profile.email);
  const threadId = user
    ? `dm:${[user.id, userId].sort().join(":")}`
    : null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold">{displayName}</p>
            {profile?.roleName && (
              <p className="truncate text-sm text-muted-foreground">{profile.roleName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : !profile ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Profile not available.</p>
        ) : (
          <>
            <dl className="space-y-3 rounded-xl bg-muted/50 p-3 text-sm">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Dealership</dt>
                <dd className="mt-0.5">{profile.dealershipName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Role</dt>
                <dd className="mt-0.5">{profile.roleName || "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Phone</dt>
                <dd className="mt-0.5">{profile.phoneNumber ? formatPhone(profile.phoneNumber) : "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Email</dt>
                <dd className="mt-0.5 truncate">{showEmail ? profile.email : "—"}</dd>
              </div>
            </dl>

            <div className="mt-4 flex gap-2">
              {threadId && userId !== user?.id && (
                <Link
                  to="/thread/$threadId"
                  params={{ threadId }}
                  onClick={onClose}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  <MessageSquare className="h-4 w-4" /> Message
                </Link>
              )}
              {profile.phoneNumber && (
                <a
                  href={`tel:${profile.phoneNumber}`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-foreground"
                >
                  <Phone className="h-4 w-4" /> Call
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

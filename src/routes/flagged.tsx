// Flagged Cars — every car that has sat untouched for 14+ days.
// The list is stamped once a day at 5 AM Pacific by the stale-cars hook.
// Swiping a row only removes it from this list; the car stays in Huri.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BottomBar, HuriLogo } from "@/components/BottomBar";
import { SwipeRow } from "@/components/SwipeRow";
import { ListSkeleton } from "@/components/ListSkeleton";
import { canViewFlagged, isSpectatorRole } from "@/lib/roles";
import { flaggedCarsQuery, type FlaggedCarRow } from "@/lib/queries";
import { locationLabel } from "@/lib/lot";

export const Route = createFileRoute("/flagged")({
  head: () => ({
    meta: [
      { title: "Flagged Cars · Huri" },
      { name: "description", content: "Cars parked 14 days or longer without being moved." },
      { property: "og:title", content: "Flagged Cars · Huri" },
      { property: "og:description", content: "Cars parked 14 days or longer without being moved." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FlaggedPage,
});

const daysParked = (since: string | null | undefined) =>
  since ? Math.floor((Date.now() - new Date(since).getTime()) / 86400000) : 0;

function FlaggedPage() {
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const queryClient = useQueryClient();

  const allowed = canViewFlagged(profile?.role_name) || !!profile?.is_owner;
  // Spectators watch the list but never change it.
  const canDismiss = allowed && !isSpectatorRole(profile?.role_name);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  const { data: cars = [], isPending } = useQuery({
    ...flaggedCarsQuery(),
    enabled: !!user && allowed,
  });

  const dismiss = async (id: string) => {
    const { error } = await supabase
      .from("parked_cars")
      .update({ flag_dismissed_at: new Date().toISOString(), flagged_at: null })
      .eq("id", id);
    if (!error) void queryClient.invalidateQueries({ queryKey: ["flagged-cars"] });
  };

  if (!loading && user && !allowed) {
    return (
      <div className="min-h-screen bg-surface px-4 pb-32 safe-top">
        <Header />
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Flagged Cars is only available to management and spectator accounts.
        </p>
        <BottomBar active="lot" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface pb-32 safe-top">
      <div className="px-4">
        <Header />
      </div>

      <p className="px-4 pb-3 text-xs text-muted-foreground">
        Cars untouched for 14 days or longer, newest first. Updated every morning at 5 AM.
      </p>

      {isPending ? (
        <div className="px-4">
          <ListSkeleton />
        </div>
      ) : cars.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">No flagged cars right now.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden border-y border-border bg-card">
          {cars.map((car) => (
            <li key={car.id}>
              {canDismiss ? (
                <SwipeRow onDelete={() => void dismiss(car.id)}>
                  <CarRow car={car} />
                </SwipeRow>
              ) : (
                <CarRow car={car} />
              )}
            </li>
          ))}
        </ul>
      )}

      <BottomBar active="lot" />
    </div>
  );
}

function CarRow({ car }: { car: FlaggedCarRow }) {
  const days = daysParked(car.located_at);
  return (
    <div className="bg-card px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">
          {car.ro_number ? `RO #${car.ro_number}` : "No RO #"}
        </span>
        <span className="text-xs font-semibold text-destructive">{days} days</span>
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        {[
          car.tag_number ? `Tag #${car.tag_number}` : null,
          car.car_model,
          locationLabel(car.lot_position),
        ]
          .filter(Boolean)
          .join(" · ")}
      </div>
      {car.notes && <div className="mt-0.5 text-xs text-muted-foreground">{car.notes}</div>}
    </div>
  );
}

function Header() {
  const navigate = useNavigate();
  return (
    <header className="flex items-center gap-2 pb-3 pt-3">
      <button
        type="button"
        aria-label="Back"
        onClick={() => navigate({ to: "/pickup" })}
        className="rounded-full p-1 active:bg-accent"
      >
        <ArrowLeft className="h-6 w-6" />
      </button>
      <HuriLogo />
      <div className="flex-1" />
      <span className="text-sm font-semibold text-muted-foreground">Flagged Cars</span>
    </header>
  );
}

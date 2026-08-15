// Technician entry point: "Bring Me" → pick Car or Parts, then the normal form.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft, Car, Wrench } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { HuriLogo, TopActions } from "@/components/BottomBar";

export const Route = createFileRoute("/bring-me")({
  head: () => ({
    meta: [
      { title: "Bring Me · Huri" },
      { name: "description", content: "Ask a valet to bring you a car or parts." },
      { property: "og:title", content: "Bring Me · Huri" },
      { property: "og:description", content: "Ask a valet to bring you a car or parts." },
    ],
  }),
  component: BringMePage,
});

function BringMePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-surface safe-top safe-bottom">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <HuriLogo />
        <div className="flex-1" />
        <TopActions />
        <Link to="/pickup" aria-label="Back" className="grid h-8 w-8 place-items-center rounded-full text-primary"><ArrowLeft className="h-5 w-5" /></Link>
      </header>

      <div className="px-4 pt-4">
        <h1 className="text-2xl font-bold tracking-tight">Bring Me</h1>
        <div className="mt-2 flex items-center gap-1.5" aria-hidden="true">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary/30" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 p-4">
        <Link
          to="/pickup-new"
          className="flex min-h-48 flex-col items-center justify-center gap-5 rounded-3xl border border-border bg-background shadow-sm active:bg-accent"
        >
          <Car className="h-12 w-12 text-primary" />
          <span className="text-xl font-bold text-foreground">Car</span>
        </Link>
        <Link
          to="/parts"
          className="flex min-h-48 flex-col items-center justify-center gap-5 rounded-3xl border border-border bg-background shadow-sm active:bg-accent"
        >
          <Wrench className="h-12 w-12 text-primary" />
          <span className="text-xl font-bold text-foreground">Parts</span>
        </Link>
      </div>
    </div>
  );
}

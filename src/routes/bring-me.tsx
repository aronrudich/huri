// Technician entry point: "Bring Me" → pick Car or Parts, then the normal form.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft, Car, Wrench } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { HuriLogo } from "@/components/BottomBar";

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
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <HuriLogo />
        <div className="flex-1" />
        <Link to="/pickup" className="grid h-8 w-8 place-items-center rounded-full text-primary"><ArrowLeft className="h-5 w-5" /></Link>
      </header>

      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <Link
          to="/pickup-new"
          className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-2xl bg-primary text-primary-foreground shadow-sm active:opacity-90"
        >
          <Car className="h-14 w-14" />
          <span className="text-2xl font-bold">Car</span>
        </Link>
        <Link
          to="/parts"
          className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-primary bg-background text-primary shadow-sm active:bg-accent"
        >
          <Wrench className="h-14 w-14" />
          <span className="text-2xl font-bold">Parts</span>
        </Link>
      </div>
    </div>
  );
}

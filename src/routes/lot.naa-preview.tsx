import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { NaaPreviewMap } from "@/components/NaaPreviewMap";

export const Route = createFileRoute("/lot/naa-preview")({
  head: () => ({
    meta: [
      { title: "NAA Test Map · Huri" },
      { name: "description", content: "Private interactive sandbox for reviewing the complete Norwalk Auto Auction lot layout." },
      { property: "og:title", content: "NAA Test Map · Huri" },
      { property: "og:description", content: "Private interactive sandbox for reviewing the complete Norwalk Auto Auction lot layout." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NaaPreviewPage,
});

function NaaPreviewPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, navigate, user]);

  if (loading || !user) {
    return <div className="grid h-dvh place-items-center bg-surface text-sm text-muted-foreground">Opening private test map…</div>;
  }

  return <main className="flex h-dvh min-h-0 flex-col overflow-hidden"><NaaPreviewMap /></main>;
}
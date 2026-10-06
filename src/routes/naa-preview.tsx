import { createFileRoute } from "@tanstack/react-router";
import { NaaPreviewMap } from "@/components/NaaPreviewMap";

export const Route = createFileRoute("/naa-preview")({
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
  return <main className="flex h-dvh min-h-0 flex-col overflow-hidden"><NaaPreviewMap /></main>;
}

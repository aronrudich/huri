import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { TERMS_MD } from "@/lib/legal-content";

const desc = "Terms of Service and commercial subscription agreement for Huri, operated by Cidur LLC";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service · Huri" },
      { name: "description", content: desc },
      { property: "og:title", content: "Terms of Service · Huri" },
      { property: "og:description", content: desc },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LegalPage markdown={TERMS_MD} />,
});

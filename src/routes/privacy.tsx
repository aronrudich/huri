import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { PRIVACY_MD } from "@/lib/legal-content";

const desc = "Privacy Policy for Huri lot management, operated by Cidur LLC";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy · Huri" },
      { name: "description", content: desc },
      { property: "og:title", content: "Privacy Policy · Huri" },
      { property: "og:description", content: desc },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LegalPage markdown={PRIVACY_MD} />,
});

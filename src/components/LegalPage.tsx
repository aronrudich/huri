import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import huriLogo from "@/assets/huri-logo-compressed.png.asset.json";

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i} className="rounded bg-muted px-1 text-[0.9em]">{p.slice(1, -1)}</code>;
    if (p.length > 2 && p.startsWith("*") && p.endsWith("*")) return <em key={i}>{p.slice(1, -1)}</em>;
    return p;
  });
}

function renderMarkdown(md: string) {
  const blocks = md.split(/\n\s*\n/);
  return blocks.map((block, i) => {
    const b = block.trim();
    if (!b) return null;
    if (b === "---") return <hr key={i} className="my-6 border-border" />;
    if (b.startsWith("# ")) return <h1 key={i} className="text-2xl font-bold tracking-tight text-foreground">{b.slice(2)}</h1>;
    if (b.startsWith("### ")) return <h2 key={i} className="mt-2 text-lg font-semibold text-foreground">{inline(b.slice(4))}</h2>;
    const lines = b.split("\n");
    if (lines.every((l) => /^\* /.test(l))) {
      return <ul key={i} className="list-disc space-y-1.5 pl-5">{lines.map((l, j) => <li key={j}>{inline(l.slice(2))}</li>)}</ul>;
    }
    if (lines.every((l) => /^\d+\. /.test(l))) {
      return <ol key={i} className="list-decimal space-y-1.5 pl-5">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\d+\. /, ""))}</li>)}</ol>;
    }
    return (
      <p key={i}>
        {lines.map((l, j) => (
          <span key={j}>{inline(l.replace(/\s+$/, ""))}{j < lines.length - 1 && <br />}</span>
        ))}
      </p>
    );
  });
}

export function LegalPage({ markdown }: { markdown: string }) {
  const router = useRouter();
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
    else router.navigate({ to: "/" });
  };
  return (
    <div className="min-h-screen bg-surface safe-top safe-bottom">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <button type="button" onClick={goBack} aria-label="Go back" className="grid h-10 w-10 place-items-center rounded-full active:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={huriLogo.url} alt="Huri" className="h-8 w-auto" />
        <span className="w-10 text-right text-[10px] leading-tight text-muted-foreground">Updated Oct 2026</span>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <article className="space-y-4 rounded-2xl border border-border bg-card p-6 text-sm leading-relaxed text-muted-foreground shadow-sm">
          {renderMarkdown(markdown)}
        </article>
      </main>
    </div>
  );
}

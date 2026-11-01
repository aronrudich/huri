import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Copy, Info, X } from "lucide-react";
import { toast } from "sonner";
import step1 from "@/assets/tekion-step-1.png.asset.json";
import step2 from "@/assets/tekion-step-2.png.asset.json";
import step3 from "@/assets/tekion-step-3.png.asset.json";
import step4 from "@/assets/tekion-step-4.png.asset.json";
import { ARRIVE_BASE } from "@/lib/arrive-link";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; companySlug: string };

const Code = ({ children }: { children: ReactNode }) => (
  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">{children}</code>
);

export function TekionGuideModal({ open, onOpenChange, companySlug }: Props) {
  const [step, setStep] = useState(0);
  const link = `${ARRIVE_BASE}/${companySlug}?ro=<ro_no>`;

  useEffect(() => {
    if (!open) return;
    setStep(0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
      if (e.key === "ArrowRight") setStep((s) => Math.min(3, s + 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onOpenChange]);

  if (!open) return null;

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(link); toast.success("Tekion link copied"); }
    catch { toast.error("Couldn't copy — select the link and copy it manually"); }
  };

  const steps: { title: string; img: string; body: ReactNode }[] = [
    {
      title: "Open Templates",
      img: step1.url,
      body: (
        <ol className="list-decimal space-y-1 pl-5">
          <li>Open <b>Communication Templates</b> in Tekion.</li>
          <li>Select <b>Text</b>. <i>(Do not select Email.)</i></li>
          <li>Press <b>New Template</b>.</li>
        </ol>
      ),
    },
    {
      title: "Fill Template Details",
      img: step2.url,
      body: (
        <>
          <p>Fill out the form with the exact information below, then press <b>Publish</b>:</p>
          <ul className="mt-2 space-y-1">
            <li><b>Name:</b> <Code>Huri - ETA</Code></li>
            <li><b>Quick Search Tag:</b> <Code>#HuriETA</Code></li>
            <li><b>Communication Type:</b> <Code>Required Dealership Business</Code></li>
            <li><b>Department:</b> <Code>Service, Sales, Parts</Code></li>
            <li><b>Categories:</b> <Code>Repair Order, Service Miscellaneous, Follow-up Text, Internal, Service Appointment</Code></li>
          </ul>
        </>
      ),
    },
    {
      title: "Create Message & Insert Link",
      img: step3.url,
      body: (
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Compose the message your customers will receive from their service advisors:
            <blockquote className="mt-1.5 rounded-lg border-l-4 border-primary bg-muted/60 p-2.5 text-[13px] italic">
              Hi &lt;ro_customer_first_name&gt;, your &lt;ro_vehicle_year_make_model&gt; is finished. If you want to skip the wait, press the link below so we can have your car pulled up and ready.
              <span className="my-1 block break-all font-mono not-italic">{link}</span>
              See you soon!
            </blockquote>
            <button type="button" onClick={copyLink} className="mt-2 flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
              <Copy className="h-3.5 w-3.5" /> Copy Tekion Link
            </button>
          </li>
          <li>It is <b>mandatory</b> to include <Code>&lt;ro_no&gt;</Code> directly after <Code>=</Code>. To add an insert in Tekion, press the <Code>&lt; &gt;</Code> button under the text box and select it from the list.</li>
          <li>Press <b>Publish</b>.</li>
          <li>Test your new message by pressing <b>Send a Test Message</b> in the top-right corner.</li>
        </ol>
      ),
    },
    {
      title: "Advisor Workflow",
      img: step4.url,
      body: (
        <ol className="list-decimal space-y-1 pl-5">
          <li>Service advisors send the text from customer chats by tapping the <b>Template</b> button and choosing <Code>Huri - ETA</Code>.</li>
          <li>Customers don't need to enter their name, phone, email, or car info — they simply choose their ETA and tap submit. The pickup automatically appears in Huri.</li>
        </ol>
      ),
    },
  ];
  const s = steps[step];

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-foreground/50 sm:items-center sm:p-4" onClick={() => onOpenChange(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tekion-guide-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[95dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-background text-foreground shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-start gap-3 border-b border-border p-4">
          <div className="min-w-0 flex-1">
            <h2 id="tekion-guide-title" className="text-lg font-bold">Connect Huri to Tekion</h2>
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-primary/10 p-2 text-xs text-primary">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              A login with Manager or Admin access is required to access Communication Templates in Tekion.
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={() => onOpenChange(false)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto px-4 pt-3">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              aria-current={i === step ? "step" : undefined}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              Step {i + 1}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 text-sm">
          <h3 className="mb-2 text-base font-semibold">Step {step + 1} — {s.title}</h3>
          {s.body}
          <a href={s.img} target="_blank" rel="noreferrer" className="mt-4 block overflow-hidden rounded-xl border border-border">
            <img src={s.img} alt={`Tekion step ${step + 1}: ${s.title}`} className="w-full" loading="lazy" />
          </a>
          <p className="mt-1 text-center text-[11px] text-muted-foreground">Tap the image to view full size</p>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border p-3">
          <button type="button" disabled={step === 0} onClick={() => setStep(step - 1)} className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-primary disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          {step < 3 ? (
            <button type="button" onClick={() => setStep(step + 1)} className="flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Done</button>
          )}
        </div>
      </div>
    </div>
  );
}

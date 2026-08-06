import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { locationChoice, normalizeSpot, type LocationChoice } from "@/lib/lot";

type LocationPickerProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

const OPTIONS: { id: LocationChoice; label: string; detail: string }[] = [
  { id: "BL", label: "BL", detail: "Back Lot" },
  { id: "CP", label: "CP", detail: "Customer Parking" },
  { id: "SV", label: "SV", detail: "Spots 1–147" },
  { id: "BAY", label: "Bay", detail: "In a bay" },
  { id: "OTHER", label: "Other", detail: "Custom location" },
];

export function LocationPicker({ value, onChange, required }: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<LocationChoice>(() => locationChoice(value));
  const [detail, setDetail] = useState(() => {
    const normalized = normalizeSpot(value);
    if (normalized?.startsWith("SV ")) return normalized.slice(3);
    return locationChoice(value) === "OTHER" ? value : "";
  });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const normalized = normalizeSpot(value);
    const nextChoice = locationChoice(value);
    setChoice(nextChoice);
    setDetail(normalized?.startsWith("SV ") ? normalized.slice(3) : nextChoice === "OTHER" ? value : "");
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const select = (next: LocationChoice) => {
    setChoice(next);
    setOpen(false);
    if (next === "BL" || next === "CP" || next === "BAY") {
      setDetail("");
      onChange(next);
    } else {
      setDetail("");
      onChange("");
    }
  };

  const selected = OPTIONS.find((option) => option.id === choice);

  return (
    <div ref={rootRef}>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        Location{required && <span className="ml-1 text-primary">(Required)</span>}
      </label>
      <div className="relative">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="flex w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-3 text-left text-base outline-none focus:border-primary"
        >
          <span className={selected ? "text-foreground" : "text-muted-foreground"}>
            {selected ? `${selected.label} · ${selected.detail}` : "Choose a location"}
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
            {OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => select(option.id)}
                className="flex w-full items-center justify-between border-b border-border px-3 py-3 text-left last:border-b-0 active:bg-accent"
              >
                <span className="font-semibold">{option.label}</span>
                <span className="text-sm text-muted-foreground">{option.detail}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {choice === "SV" && (
        <div className="mt-2">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">SV spot number</label>
          <input
            value={detail}
            onChange={(event) => {
              const next = event.target.value.replace(/\D/g, "").slice(0, 3);
              setDetail(next);
              onChange(next ? `SV ${next}` : "");
            }}
            inputMode="numeric"
            placeholder="1–147"
            autoFocus
            className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none placeholder:text-muted-foreground focus:border-primary"
          />
        </div>
      )}

      {choice === "OTHER" && (
        <div className="mt-2">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Other location</label>
          <input
            value={detail}
            onChange={(event) => {
              const next = event.target.value.slice(0, 60);
              setDetail(next);
              onChange(next);
            }}
            maxLength={60}
            autoFocus
            className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary"
          />
        </div>
      )}
    </div>
  );
}
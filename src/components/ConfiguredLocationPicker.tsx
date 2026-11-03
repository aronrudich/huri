import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { LocationRule } from "@/lib/company-locations";

export function configuredLocationOptions(rules: LocationRule[]) {
  const lots = [...new Set(rules.map((rule) => rule.lot_name))];
  lots.sort((a, b) => Number(rules.some((r) => r.lot_name === b && r.capacity === 1)) - Number(rules.some((r) => r.lot_name === a && r.capacity === 1)) || a.localeCompare(b, undefined, { numeric: true }));
  return [...lots, "Technician Bay", "Other", "Unknown"].filter((name, i, all) => all.indexOf(name) === i);
}

export function ConfiguredLocationPicker({ value, onChange, rules, required }: { value: string; onChange: (value: string) => void; rules: LocationRule[]; required?: boolean }) {
  const id = useId();
  const emitted = useRef(value);
  const [choice, setChoice] = useState("");
  const [detail, setDetail] = useState("");
  const options = configuredLocationOptions(rules);
  const sync = (next: string) => {
    const rule = rules.find((r) => r.label === next.toUpperCase());
    if (rule) { setChoice(rule.lot_name); setDetail(rule.capacity === 1 ? rule.label.replace(`${rule.lot_name.toUpperCase()} `, "") : ""); }
    else { setChoice(next === "BAY" ? "Technician Bay" : next === "UNKNOWN" ? "Unknown" : next ? "Other" : ""); setDetail(next === "BAY" || next === "UNKNOWN" ? "" : next); }
  };
  const ruleSignature = JSON.stringify(rules);
  useEffect(() => { sync(value); }, [ruleSignature]);
  useEffect(() => { if (value !== emitted.current) { emitted.current = value; sync(value); } }, [value]);
  const emit = (next: string) => { emitted.current = next; onChange(next); };
  const numbered = rules.filter((r) => r.lot_name === choice && r.capacity === 1);
  const numberDetail = numbered.map((r) => Number(r.label.replace(`${choice.toUpperCase()} `, ""))).filter(Number.isFinite);
  const placeholder = numberDetail.length ? `${Math.min(...numberDetail)}–${Math.max(...numberDetail)}` : "Spot number";
  return <div className="space-y-2">
    <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">Location{required ? " (Required)" : ""}</label>
    <select id={id} aria-label="Location" value={choice} onChange={(e) => {
      const next = e.target.value; setChoice(next); setDetail("");
      const rule = rules.find((r) => r.lot_name === next && r.capacity === 0);
      emit(next === "Technician Bay" ? "BAY" : next === "Unknown" ? "UNKNOWN" : rule?.label ?? "");
    }} className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base">
      <option value="">Choose A Location</option>{options.map((name) => <option key={name}>{name}</option>)}
    </select>
    {numbered.length > 0 && <label className="block text-xs text-muted-foreground">Spot number
      <input aria-label="Spot number" inputMode="numeric" placeholder={placeholder} value={detail} onChange={(e) => {
        const next = e.target.value.replace(/\D/g, "").slice(0, 6); setDetail(next);
        const label = `${choice.toUpperCase()} ${Number(next)}`;
        emit(next && numbered.some((r) => r.label === label) ? label : "");
      }} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-3 text-base" />
    </label>}
    {choice === "Other" && <input aria-label="Other location" value={detail} maxLength={60} onChange={(e) => { setDetail(e.target.value); emit(e.target.value); }} className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base" />}
    {choice && <Button type="button" className="bg-muted text-foreground" onClick={() => { setChoice(""); setDetail(""); emit(""); }}>Clear location</Button>}
  </div>;
}
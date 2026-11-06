import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { LocationRule } from "@/lib/company-locations";
import { flushSync } from "react-dom";
import { locationName, orderedLocationNames } from "@/lib/location-display";

export function configuredLocationOptions(rules: LocationRule[], companyCode?: string) {
  return orderedLocationNames(rules, companyCode);
}

export function ConfiguredLocationPicker({ value, onChange, rules, required, companyCode }: { value: string; onChange: (value: string) => void; rules: LocationRule[]; required?: boolean; companyCode?: string }) {
  const id = useId();
  const numberInput = useRef<HTMLInputElement>(null);
  const emitted = useRef(value);
  const [choice, setChoice] = useState("");
  const [detail, setDetail] = useState("");
  const options = configuredLocationOptions(rules, companyCode);
  const sync = (next: string) => {
    if (/^GPS( PIN)?$/i.test(next.trim())) { setChoice("Location saved"); setDetail(""); return; }
    const rule = rules.find((r) => r.label.toUpperCase() === next.toUpperCase());
    if (rule) { setChoice(locationName(rule.lot_name)); setDetail(rule.capacity === 1 ? rule.label.replace(`${rule.lot_name.toUpperCase()} `, "") : ""); }
    else if (/^charg(er|ing)$/i.test(next)) { setChoice("Charger"); setDetail(""); }
    else { setChoice(next === "BAY" ? "Technician Bay" : next === "UNKNOWN" ? "Unknown" : next ? "Other" : ""); setDetail(next === "BAY" || next === "UNKNOWN" ? "" : next); }
  };
  const ruleSignature = JSON.stringify(rules);
  useEffect(() => { sync(value); }, [ruleSignature]);
  useEffect(() => { if (value !== emitted.current) { emitted.current = value; sync(value); } }, [value]);
  const emit = (next: string) => { emitted.current = next; onChange(next); };
  const numbered = rules.filter((r) => locationName(r.lot_name) === choice && r.capacity === 1);
  const numberDetail = numbered.map((r) => Number(r.label.slice(r.lot_name.length).trim())).filter(Number.isFinite);
  const placeholder = numberDetail.length ? `${Math.min(...numberDetail)}–${Math.max(...numberDetail)}` : "Spot number";
  return <div className="space-y-2">
    <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">Location{required ? " (Required)" : ""}</label>
    <select id={id} aria-label="Location" value={choice} onChange={(e) => {
      const next = e.target.value;
      // Mount and focus in the selection gesture so iOS can open its keypad.
      flushSync(() => { setChoice(next); setDetail(""); });
      if (rules.some((r) => locationName(r.lot_name) === next && r.capacity === 1)) numberInput.current?.focus();
      const rule = rules.find((r) => locationName(r.lot_name) === next && r.capacity === 0);
      emit(next === "Technician Bay" ? "BAY" : next === "Unknown" ? "UNKNOWN" : rule?.label ?? "");
    }} className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base">
      <option value="">Choose A Location</option>{choice === "Location saved" && <option>Location saved</option>}{options.map((name) => <option key={name}>{name}</option>)}
    </select>
    {numbered.length > 0 && <label className="block text-xs text-muted-foreground">Spot number
      <input ref={numberInput} aria-label="Spot number" inputMode="numeric" placeholder={placeholder} value={detail} onChange={(e) => {
        const next = e.target.value.replace(/\D/g, "").slice(0, 6); setDetail(next);
        const rule = numbered.find((r) => Number(r.label.slice(r.lot_name.length).trim()) === Number(next));
        emit(next && rule ? rule.label : "");
      }} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-3 text-base" />
    </label>}
    {choice === "Other" && <input aria-label="Other location" value={detail} maxLength={60} onChange={(e) => { setDetail(e.target.value); emit(e.target.value); }} className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base" />}
    {choice && <Button type="button" className="bg-muted text-foreground" onClick={() => { setChoice(""); setDetail(""); emit(""); }}>Clear location</Button>}
  </div>;
}
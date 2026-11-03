import type { LocationRule } from "./company-locations";

const BMW_ORDER = ["Service Lot", "Service Done", "Used Car Service", "W1", "W2", "Charger", "Technician Bay", "Other", "Unknown"];

export function locationName(name: string): string {
  const trimmed = name.trim();
  if (/^charg(er|ing)$/i.test(trimmed)) return "Charger";
  if (/^(bay|technician bay)$/i.test(trimmed)) return "Technician Bay";
  return BMW_ORDER.find((item) => item.toUpperCase() === trimmed.toUpperCase()) ?? trimmed;
}

export function orderedLocationNames(rules: LocationRule[], companyCode?: string): string[] {
  const lots = [...new Set(rules.map((rule) => locationName(rule.lot_name)))];
  if (companyCode === "BMWR2985") return [...BMW_ORDER, ...lots.filter((name) => !BMW_ORDER.includes(name))];
  lots.sort((a, b) => Number(rules.some((r) => locationName(r.lot_name) === b && r.capacity === 1)) - Number(rules.some((r) => locationName(r.lot_name) === a && r.capacity === 1)) || a.localeCompare(b, undefined, { numeric: true }));
  return [...new Set([...lots, "Technician Bay", "Other", "Unknown"])];
}

export function carLocationGroup(position: string | null, rules: LocationRule[]): string {
  const normalized = position?.trim().toUpperCase() ?? "";
  if (!normalized || normalized === "UNKNOWN") return "Unknown";
  if (normalized === "BAY" || normalized === "TECHNICIAN BAY") return "Technician Bay";
  const rule = rules.find((item) => item.label.toUpperCase() === normalized);
  if (rule) return locationName(rule.lot_name);
  const area = orderedLocationNames(rules).find((name) => name.toUpperCase() === normalized);
  return area ?? (/^CHARG(ER|ING)$/.test(normalized) ? "Charger" : "Other");
}

export function lotFilterNames(rules: LocationRule[], companyCode?: string): string[] {
  return [...new Set(orderedLocationNames(rules, companyCode).map((name) => companyCode === "BMWR2985" && (name === "W1" || name === "W2") ? "W1 & W2" : name))];
}

export function matchesLocationFilter(position: string | null, filter: string, rules: LocationRule[]): boolean {
  const group = carLocationGroup(position, rules);
  return filter === "All Locations" || (filter === "W1 & W2" ? group === "W1" || group === "W2" : group === filter);
}

export function configuredSpotBadge(position: string, rules: LocationRule[]): string {
  const group = carLocationGroup(position, rules);
  const rule = rules.find((item) => item.label.toUpperCase() === position.toUpperCase());
  if (rule?.capacity === 1) return position.slice(rule.lot_name.length).trim();
  return ({ "Service Done": "DONE", "Used Car Service": "USED", "Charger": "CHG", "Technician Bay": "BAY", "Other": "OTHER", "Unknown": "?" } as Record<string, string>)[group] ?? (group === "W1" || group === "W2" ? group : position);
}
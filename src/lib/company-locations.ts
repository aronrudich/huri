import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadAllCarPages } from "./car-loading";
import { adjacentSpots } from "./lot";

export type LocationRule = { label: string; lot_name: string; capacity: number; blockers: string[] };
export const companyLocationsQuery = (companyId?: string | null) => queryOptions({
  queryKey: ["company-locations", companyId], enabled: !!companyId, staleTime: 60_000,
  queryFn: async (): Promise<LocationRule[]> => {
    if (!companyId) return [];
    return loadAllCarPages((from, to) => supabase.from("company_location_rules")
      .select("label, lot_name, capacity, blockers").eq("dealership_id", companyId).order("label").range(from, to));
  },
});

export function blockersForLocation(label: string | null, rules: LocationRule[], isJcd: boolean): string[] {
  const rule = rules.find((r) => r.label === label);
  if (rule) return rule.blockers;
  return isJcd ? adjacentSpots(label) : [];
}
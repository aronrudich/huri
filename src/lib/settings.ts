import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Huri runs one universal system for every company. The only things a company
 * can change are the parameters below, stored on its own `dealerships` row.
 */
export type DealershipSettings = {
  id: string;
  name: string;
  company_code: string;
  /** Public handle used in the customer arrival link — safe to share. */
  slug: string;
  flagged_days: number;
  reminder_minutes: number;
  claim_hide_minutes: number;
  timezone: string;
  enable_wash: boolean;
  enable_parts: boolean;
  enable_staging: boolean;
};

export const SETTINGS_DEFAULTS = {
  flagged_days: 14,
  reminder_minutes: 5,
  claim_hide_minutes: 30,
  timezone: "America/Los_Angeles",
  enable_wash: true,
  enable_parts: true,
  enable_staging: true,
} as const;

const SETTINGS_COLUMNS =
  "id, name, company_code, slug, flagged_days, reminder_minutes, claim_hide_minutes, timezone, enable_wash, enable_parts, enable_staging";

/** The signed-in employee's own company settings (RLS hides every other company). */
export const dealershipSettingsQuery = (dealershipId?: string | null) =>
  queryOptions({
    queryKey: ["dealership-settings", dealershipId ?? ""],
    enabled: !!dealershipId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<DealershipSettings | null> => {
      const { data, error } = await supabase
        .from("dealerships")
        .select(SETTINGS_COLUMNS)
        .eq("id", dealershipId!)
        .maybeSingle();
      if (error) throw error;
      return (data as DealershipSettings | null) ?? null;
    },
  });

/** Bounds mirrored from the database check constraint. */
export const SETTINGS_LIMITS = {
  flagged_days: { min: 1, max: 3650 },
  reminder_minutes: { min: 0, max: 1440 },
  claim_hide_minutes: { min: 1, max: 1440 },
} as const;

export type NumericSettingKey = keyof typeof SETTINGS_LIMITS;

/** US time zones a dealership can pick from. */
export const TIMEZONE_OPTIONS = [
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "America/Phoenix", label: "Arizona" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
];

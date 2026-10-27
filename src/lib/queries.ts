import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDirectory } from "@/lib/directory.functions";
import { loadAllCarPages } from "@/lib/car-loading";

/**
 * A phone that falls asleep mid-request leaves the fetch hanging forever, which
 * is what made screens stick on old data until the app was force-quit. Every
 * read gets a 10s ceiling so it fails fast and React Query retries it.
 */
const timeoutSignal = (signal?: AbortSignal, ms = 10_000): AbortSignal => {
  const timeout = AbortSignal.timeout(ms);
  const any = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any;
  return signal && any ? any([signal, timeout]) : timeout;
};

export type DirectoryMap = Record<string, { name: string; avatarUrl: string | null }>;
export type RolesMap = Record<string, string>;

/** id -> display name + avatar for every profile visible to the caller. */
export const directoryQuery = () =>
  queryOptions({
    queryKey: ["directory"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<DirectoryMap> => {
      const data = await getDirectory();
      const map: DirectoryMap = {};
      (data ?? []).forEach((p) => {
        if (p.id) {
          map[p.id] = {
            name: p.nickname || p.full_name || "",
            avatarUrl: p.avatar_url ?? null,
          };
        }
      });
      return map;
    },
  });


/** role id -> role name. */
export const rolesQuery = () =>
  queryOptions({
    queryKey: ["roles"],
    staleTime: 30 * 60_000,
    queryFn: async ({ signal }): Promise<RolesMap> => {
      const { data, error } = await supabase.from("roles").select("id, name").abortSignal(timeoutSignal(signal));
      if (error) throw error;
      const map: RolesMap = {};
      (data ?? []).forEach((r) => { map[r.id] = r.name; });
      return map;
    },
  });

export type ParkedCarRow = {
  id: string; tag_number: string | null; ro_number: string | null;
  car_model: string | null; lot_position: string; notes: string | null;
  is_staged?: boolean | null; located_at?: string | null; bay_tech?: string | null;
  notes_updated_at?: string | null;
};

/** Every active car; TAKEN records remain available through direct RO/history reads. */
export const parkedCarsQuery = () =>
  queryOptions({
    queryKey: ["parked-cars"],
    staleTime: 60_000,
    queryFn: async ({ signal }): Promise<ParkedCarRow[]> => {
      return loadAllCarPages<ParkedCarRow>((from, to) => supabase
        .from("parked_cars")
        .select("id, tag_number, ro_number, car_model, lot_position, notes, is_staged, located_at, bay_tech, notes_updated_at")
        .neq("lot_position", "TAKEN")
        .order("id", { ascending: true })
        .range(from, to)
        .abortSignal(timeoutSignal(signal)));
    },
  });

export type FlaggedCarRow = ParkedCarRow & { flagged_at: string | null };

/** Preserve pickup context for TAKEN cars without downloading all historical rows. */
export const pickupTakenCarsQuery = (ros: string[]) => {
  const uniqueRos = [...new Set(ros.filter(Boolean))].sort();
  return queryOptions({
    queryKey: ["pickup-taken-cars", uniqueRos],
    staleTime: 60_000,
    queryFn: async ({ signal }): Promise<ParkedCarRow[]> => {
      const rows: ParkedCarRow[] = [];
      for (let offset = 0; offset < uniqueRos.length; offset += 100) {
        rows.push(...await loadAllCarPages<ParkedCarRow>((from, to) => supabase
          .from("parked_cars")
          .select("id, tag_number, ro_number, car_model, lot_position, notes, is_staged, located_at, bay_tech, notes_updated_at")
          .eq("lot_position", "TAKEN")
          .in("ro_number", uniqueRos.slice(offset, offset + 100))
          .order("id", { ascending: true }).range(from, to)
          .abortSignal(timeoutSignal(signal))));
      }
      return rows;
    },
  });
};

/** Cars flagged by the daily 5 AM check as sitting 14+ days, newest first. */
export const flaggedCarsQuery = () =>
  queryOptions({
    queryKey: ["flagged-cars"],
    staleTime: 60_000,
    queryFn: async ({ signal }): Promise<FlaggedCarRow[]> => {
      const { data, error } = await supabase
        .from("parked_cars")
        .select("id, tag_number, ro_number, car_model, lot_position, notes, located_at, flagged_at, bay_tech")
        .not("flagged_at", "is", null)
        .is("flag_dismissed_at", null)
        .order("located_at", { ascending: false })
        .abortSignal(timeoutSignal(signal));
      if (error) throw error;
      return (data ?? []) as FlaggedCarRow[];
    },
  });

/** RO #s that have a recorded wash, so lists can show the green check. */
export const carWashesQuery = () =>
  queryOptions({
    queryKey: ["car-washes"],
    staleTime: 60_000,
    queryFn: async ({ signal }): Promise<string[]> => {
      const { data, error } = await supabase
        .from("car_washes")
        .select("ro_number")
        .abortSignal(timeoutSignal(signal));
      if (error) throw error;
      return (data ?? []).map((r) => (r.ro_number ?? "").trim()).filter(Boolean);
    },
  });


/** Open (non-completed) pickup/parts submissions, newest first. */
export const pickupsQuery = <T,>() =>
  queryOptions({
    queryKey: ["pickups"],
    staleTime: 30_000,
    queryFn: async ({ signal }): Promise<T[]> => {
      const { data, error } = await supabase
        .from("pickup_requests")
        .select("*")
        .in("status", ["unclaimed", "claimed"])
        .order("created_at", { ascending: false })
        .abortSignal(timeoutSignal(signal));
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });

export type ActivePickupRow = {
  ro_number: string | null; lot_position: string | null;
  kind: string | null; status: string; is_staged?: boolean | null;
};

/** Slim view of open submissions used by the lot map to color stalls. */
export const lotActivePickupsQuery = () =>
  queryOptions({
    queryKey: ["lot-active-pickups"],
    staleTime: 30_000,
    queryFn: async ({ signal }): Promise<ActivePickupRow[]> => {
      const { data, error } = await supabase
        .from("pickup_requests")
        .select("ro_number, lot_position, kind, status, is_staged")
        .in("status", ["unclaimed", "claimed"])
        .abortSignal(timeoutSignal(signal));
      if (error) throw error;
      return (data ?? []) as ActivePickupRow[];
    },
  });

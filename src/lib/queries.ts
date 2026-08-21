import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDirectory, getMessageRecipients } from "@/lib/directory.functions";

export type DirectoryMap = Record<string, { name: string; avatarUrl: string | null }>;
export type RolesMap = Record<string, string>;
export type RecipientHit = { id: string; name: string; avatarUrl: string | null };

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

export type Recipient = {
  id: string;
  fullName: string | null;
  nickname: string | null;
  roleName: string | null;
  avatarUrl?: string | null;
};

/** Everyone that can be messaged. */
export const messageRecipientsQuery = () =>
  queryOptions({
    queryKey: ["message-recipients"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Recipient[]> => {
      const data = await getMessageRecipients();
      return (data ?? []) as Recipient[];
    },
  });

/** "Name (Role)" formatting used by search lists. */
export const formatRecipient = (p: Recipient): RecipientHit => ({
  id: p.id,
  name: `${p.nickname || p.fullName}${p.roleName ? ` (${p.roleName})` : ""}`,
  avatarUrl: p.avatarUrl ?? null,
});

/** role id -> role name. */
export const rolesQuery = () =>
  queryOptions({
    queryKey: ["roles"],
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<RolesMap> => {
      const { data, error } = await supabase.from("roles").select("id, name");
      if (error) throw error;
      const map: RolesMap = {};
      (data ?? []).forEach((r) => { map[r.id] = r.name; });
      return map;
    },
  });

export type ParkedCarRow = {
  id: string; tag_number: string | null; ro_number: string | null;
  car_model: string | null; lot_position: string; notes: string | null;
  is_staged?: boolean | null; located_at?: string | null;
};

/** Every car currently tracked in Huri. */
export const parkedCarsQuery = () =>
  queryOptions({
    queryKey: ["parked-cars"],
    staleTime: 60_000,
    queryFn: async (): Promise<ParkedCarRow[]> => {
      const { data, error } = await supabase.from("parked_cars").select("*");
      if (error) throw error;
      return (data ?? []) as ParkedCarRow[];
    },
  });

/** Open (non-completed) pickup/parts/shuttle submissions, newest first. */
export const pickupsQuery = <T,>() =>
  queryOptions({
    queryKey: ["pickups"],
    staleTime: 30_000,
    queryFn: async (): Promise<T[]> => {
      const { data, error } = await supabase
        .from("pickup_requests")
        .select("*")
        .neq("status", "completed")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });

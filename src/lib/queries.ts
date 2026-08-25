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
      const { data, error } = await supabase
        .from("parked_cars")
        .select("id, tag_number, ro_number, car_model, lot_position, notes, is_staged, located_at");
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

export type MessageRow = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  recipient_id: string | null;
  recipient_role_id: string | null;
  body: string;
  created_at: string;
  read_at?: string | null;
};

/** Every message the signed-in user can see (direct, sent, or to one of their roles). */
export const messagesQuery = (userId: string, roleIds: string[]) =>
  queryOptions({
    queryKey: ["messages", userId, [...roleIds].sort().join(",")],
    staleTime: 30_000,
    // Keep the previous list on screen while a new key (role loaded) fetches,
    // so the inbox never flashes its "no messages yet" empty state.
    placeholderData: (prev: MessageRow[] | undefined) => prev,
    queryFn: async (): Promise<MessageRow[]> => {
      const parts = [
        `recipient_id.eq.${userId}`,
        `sender_id.eq.${userId}`,
        `thread_id.like.group:*:${userId}`,
      ];
      if (roleIds.length) parts.push(`recipient_role_id.in.(${roleIds.join(",")})`);
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(parts.join(","))
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as MessageRow[];
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
    queryFn: async (): Promise<ActivePickupRow[]> => {
      const { data, error } = await supabase
        .from("pickup_requests")
        .select("ro_number, lot_position, kind, status, is_staged")
        .neq("status", "completed");
      if (error) throw error;
      return (data ?? []) as ActivePickupRow[];
    },
  });

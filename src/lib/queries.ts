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

/** Everyone that can be messaged, pre-formatted as "Name (Role)". */
export const messageRecipientsQuery = () =>
  queryOptions({
    queryKey: ["message-recipients"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RecipientHit[]> => {
      const data = await getMessageRecipients();
      return (data ?? []).map((p) => ({
        id: p.id,
        name: `${p.nickname || p.fullName}${p.roleName ? ` (${p.roleName})` : ""}`,
        avatarUrl: p.avatarUrl ?? null,
      }));
    },
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

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { messagesQuery } from "@/lib/queries";
import { isMessageAfterCutoff, loadThreadCutoffs } from "@/lib/thread-visibility";

/**
 * True when at least one visible message addressed to the signed-in user is
 * still unread. Powers the red dot on the inbox tab icon. It reuses the same
 * cached messages query the inbox uses, so it costs no extra network calls.
 */
export function useHasUnreadMessages(): boolean {
  const { user, profile } = useAuth();
  const roleIds = useMemo(() => (profile?.role_id ? [profile.role_id] : []), [profile?.role_id]);
  const { data: messages = [] } = useQuery({
    ...messagesQuery(user?.id ?? "", roleIds),
    enabled: !!user && !!profile,
  });

  return useMemo(() => {
    if (!user) return false;
    const cutoffs = loadThreadCutoffs();
    return messages.some(
      (m) =>
        m.sender_id !== user.id &&
        !m.read_at &&
        isMessageAfterCutoff(m.created_at, cutoffs[m.thread_id]),
    );
  }, [messages, user]);
}

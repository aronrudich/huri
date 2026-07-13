import { supabase } from "@/integrations/supabase/client";

const HIDDEN_THREADS_KEY = "huri:hiddenThreadCutoffs";
const LEGACY_HIDDEN_THREADS_KEY = "huri:hiddenThreads";

export type ThreadCutoffs = Record<string, string>;

export function mergeThreadCutoffs(...cutoffSets: ThreadCutoffs[]): ThreadCutoffs {
  const merged: ThreadCutoffs = {};
  cutoffSets.forEach((cutoffs) => {
    Object.entries(cutoffs).forEach(([threadId, hiddenAt]) => {
      if (!merged[threadId] || new Date(hiddenAt).getTime() > new Date(merged[threadId]).getTime()) {
        merged[threadId] = hiddenAt;
      }
    });
  });
  return merged;
}

export function loadThreadCutoffs(): ThreadCutoffs {
  if (typeof window === "undefined") return {};
  try {
    window.localStorage.removeItem(LEGACY_HIDDEN_THREADS_KEY);
    const parsed = JSON.parse(window.localStorage.getItem(HIDDEN_THREADS_KEY) || "{}");
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch {
    return {};
  }
}

export function saveThreadCutoffs(cutoffs: ThreadCutoffs) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(HIDDEN_THREADS_KEY, JSON.stringify(cutoffs));
  }
}

export async function loadThreadCutoffsForUser(userId: string): Promise<ThreadCutoffs> {
  const local = loadThreadCutoffs();
  const { data, error } = await (supabase as any)
    .from("thread_hides")
    .select("thread_id, hidden_at")
    .eq("user_id", userId);
  if (error) {
    console.warn("[thread visibility] synced hides unavailable", error);
    return local;
  }

  const remote = Object.fromEntries(
    ((data as Array<{ thread_id: string; hidden_at: string }> | null) ?? []).map((row) => [row.thread_id, row.hidden_at]),
  );
  const merged = mergeThreadCutoffs(local, remote);
  saveThreadCutoffs(merged);
  return merged;
}

export async function hideThreadForUser(userId: string, threadId: string, hiddenAt: string) {
  const next = mergeThreadCutoffs(loadThreadCutoffs(), { [threadId]: hiddenAt });
  saveThreadCutoffs(next);
  const { error } = await (supabase as any)
    .from("thread_hides")
    .upsert({ user_id: userId, thread_id: threadId, hidden_at: hiddenAt }, { onConflict: "user_id,thread_id" });
  if (error) throw error;
}

export function isMessageAfterCutoff(createdAt: string, cutoff?: string) {
  if (!cutoff) return true;
  return new Date(createdAt).getTime() > new Date(cutoff).getTime();
}
const HIDDEN_THREADS_KEY = "huri:hiddenThreadCutoffs";
const LEGACY_HIDDEN_THREADS_KEY = "huri:hiddenThreads";

export type ThreadCutoffs = Record<string, string>;

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

export function isMessageAfterCutoff(createdAt: string, cutoff?: string) {
  if (!cutoff) return true;
  return new Date(createdAt).getTime() > new Date(cutoff).getTime();
}
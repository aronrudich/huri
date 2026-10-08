/**
 * Query data is no longer saved to disk: reopening Huri must never paint
 * hours-old pickups or report totals. This module only wipes any snapshot
 * older versions of the app left behind.
 */
const LEGACY_KEYS = ["huri.query-cache.v1", "huri.query-cache.v2", "huri.query-cache"];

export function clearPersistedQueryCache() {
  if (typeof window === "undefined") return;
  try {
    for (const k of LEGACY_KEYS) window.localStorage.removeItem(k);
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("huri.query-cache")) window.localStorage.removeItem(k);
    }
  } catch { /* storage unavailable */ }
}

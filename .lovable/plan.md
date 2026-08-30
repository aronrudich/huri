# Close the two small gaps from Claude’s review

Fix the only two remaining issues flagged in the security/correctness review.

## Changes

1. **Clear query cache on auth-state sign-out**
   - In `src/lib/auth-context.tsx`, inside the `onAuthStateChange` callback’s `else` branch (when `s` is null / user signed out), call `clearPersistedQueryCache()` before `applyProfile(null)`.
   - This ensures a shared device never briefly paints the previous user’s inbox, pickup list, or lot data when Supabase itself emits a sign-out event.

2. **Deduplicate stale push status check**
   - In `src/lib/push.functions.ts`, import `isStalePushStatus` from `./push-server.server` and replace the three inline `code === 404 || code === 410 || code === 401 || code === 403` blocks with `isStalePushStatus(code)`.
   - No behavior change; just removes duplicated logic and keeps the stale-pruning rule in one place.

## Verification

- Typecheck passes.
- No visible UI change for end users.

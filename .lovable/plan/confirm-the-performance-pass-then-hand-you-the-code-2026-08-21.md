# Confirm the performance pass, then hand you the code

## Status of the four agreed items (verified in the code just now)

1. **Logo compressed** — `src/assets/huri-logo-compressed.png.asset.json` exists (~18KB version of the 2MB original) and both `BottomBar.tsx` and `auth.tsx` point at it. The 2MB original is still on disk but unreferenced.
2. **Realtime patches instead of full-table refetches** — `pickup.tsx` now updates the cache from `payload.new` / `payload.old` via `setQueryData(["pickups"])` and `setQueryData(["parked-cars"])`, with a safety refetch retained for events a single payload can't resolve.
3. **React Query for repeated reads** — shared query definitions live in `src/lib/queries.ts` (`directory`, `message-recipients`, `roles`, `pickups`, `parked-cars`) and are consumed by `index.tsx`, `thread.$threadId.tsx`, `compose.tsx`, `pickup.tsx`, and `PeopleSearchResults.tsx`.
4. **Silent error swallowing** — the search / recipients / thread-hide `.catch(() => {})` calls now log. The only remaining empty catches are the localStorage read/write guards in `auth-context.tsx`, which are intentional.

Deferred as agreed: service-worker app-shell caching, thread-ID rework, zod validation of reads, splitting `pickup.tsx`, RLS/`supabaseAdmin` rework. Untouched: the 6-second auth watchdog, permissions, roles, copy, routes.

## What this next step does

1. Run a production build and list the emitted JS chunks, to settle the code-splitting question with evidence instead of inference — you'll get the chunk list in chat (per-route chunks vs one big bundle).
2. Package the current source into a downloadable zip and attach it here, same as last time.

No app behavior changes in this step — it's verification plus an export.

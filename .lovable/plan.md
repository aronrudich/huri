# Performance pass — my take on Claude's review

I checked each claim against the actual code. Most are right, one is already done, and one I'd skip.

## What I agree with and will do

**1. Shrink the logo (real win).** `huri-logo.png` is 2.08 MB and renders at ~50px. I'll produce a compressed version sized for retina (~120px tall, well under 50KB) and point `BottomBar.tsx` and `auth.tsx` at it. Identical appearance.

**2. Realtime payload updates instead of full-table refetches (real win).** Confirmed: in `pickup.tsx`, any insert/update/delete on `parked_cars` or `pickup_requests` triggers `select("*")` on the whole table for every connected client. I'll apply `payload.new` / `payload.old` to local state, keeping one safety refetch path for events that can't be resolved from the payload alone (e.g. the spot-displacement cascade) so nothing goes stale.

**3. React Query for the repeated reads (real win, moderate).** Directory, message recipients, roles, pickups, and parked cars are refetched from scratch on every mount. Moving those to `useQuery` with the existing QueryClient makes revisits paint instantly from cache. Realtime subscriptions stay exactly as they are and write into the query cache instead of separate `useState`.

**4. Stop swallowing errors.** The `.catch(() => {})` calls on search, message recipients, and thread-hide sync get real `console.warn` logging. No new user-facing error UI unless you want it.

## What's already done

**Route code splitting.** This template runs TanStack Start with `autoCodeSplitting` on by default, and no route file exports its component — so route components are already split into per-route chunks. `routeTree.gen.ts` importing every route file is how it's supposed to look; it isn't evidence of a single bundle. Nothing to change here.

## What I'd skip or defer

**App-shell caching in the service worker.** The gain is real but this is the riskiest item on the list: adding Workbox/vite-plugin-pwa to this build means a second service worker registration alongside the push logic, and a stale-shell bug shows up as "the app didn't update after I shipped a fix" — exactly the failure mode you don't want mid-demo. I'd do items 1–4 first, measure, and only add caching if launch still feels slow.

**Thread IDs as strings, `as` casts instead of zod, splitting `pickup.tsx`, dedup localStorage helpers.** All fair as code-health notes, none of them are performance. They're refactors that touch messaging and queue logic — the highest-risk areas — for no user-visible gain today. Happy to do them as a separate pass; I wouldn't mix them into a perf change.

**`supabaseAdmin` + manual `dealership_id` scoping.** Claude's read is correct and the risk is real for future functions, but changing it now means rewriting RLS for cross-dealership directory search. Worth a dedicated turn, not this one.

**The `setTimeout(..., 0)` in the auth listener.** Agreed — I'll add the one-line comment explaining why it must stay, since that costs nothing.

## Technical notes

- Compressed logo lands as a new local asset in `src/assets/`; the 2MB original stays in place unreferenced so nothing else breaks.
- Query keys: `["directory"]`, `["message-recipients"]`, `["roles"]`, `["pickups"]`, `["parked-cars"]`. Realtime handlers use `setQueryData`, not `invalidateQueries`, so live updates don't trigger refetches.
- No changes to the 6-second auth watchdog, permissions, role logic, copy, or routes.


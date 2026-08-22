# Make cold start and tab switches feel instant

Yes — I can see both problems in your video, and I confirmed each one against the code.

## What the video actually shows

Frame by frame, cold start goes: white screen (~1.5s) → "Loading…" → **"No messages yet. Tap the blue compose button…"** → then your real inbox appears. That third step is the "glitch" — the app briefly tells you the inbox is empty before the messages arrive.

Tab switching does the same thing. Every time you go Inbox → Pickup you get "No active pickups" for a beat, and coming back to Inbox you get "No messages yet" again, then the list snaps in. Nothing is broken; the screens just render their empty state while data is still in flight.

## Cause (verified in the code)

- The inbox message list and the lot screen still hold their data in local component state and refetch from scratch on every mount, so the list starts empty each time you land on the tab. The directory/roles/pickups reads we moved to the cache last pass do not have this problem — the message list and lot screen were never converted.
- Every screen renders its "nothing here" text whenever the list length is 0, without distinguishing "loaded and truly empty" from "still loading". That is what makes it read as a flash rather than a normal load.
- Tapping a tab downloads that tab's code chunk on the spot, because link preloading is off in the router config.
- The white screen at cold start is the browser downloading and starting the app before React can draw anything.

## The fix

**1. Keep the inbox and lot data in the cache (biggest win)**
Move the inbox messages and the lot's cars/active pickups onto the same cached-query setup the rest of the app already uses. Returning to a tab paints the previous list instantly and updates in place when fresh data lands. Live updates keep working exactly as they do now.

**2. Never show "empty" until we know it's empty**
Empty-state text only renders after the first load has finished. While loading, the screen shows the same layout with faint placeholder rows, so the header, search bar, and tab bar stay put and nothing jumps.

**3. Preload tabs before they're tapped**
Turn on the router's intent preloading and warm the four bottom-tab screens shortly after the app is idle. By the time you tap, the code is already there.

**4. Trim the cold-start wait**
Keep the current fast-paint auth behavior, and replace the bare "Loading…" text with the real app frame (logo, search bar, tab bar) plus placeholder rows, so the first thing you see already looks like Huri instead of a blank page.

## What I'm not doing

- No offline/app-shell caching in the service worker. It would cut the white screen further, but its failure mode is "the app didn't update after we shipped a fix" — not worth it while people are actively using Huri. Still available later as its own change.
- No changes to claiming, notifications, roles, permissions, routes, copy, or the database.

## Technical notes

- New query definitions in `src/lib/queries.ts`: `["messages", userId]` (the existing `.or(...)` filter, 500-row limit, unchanged) and `["lot-active-pickups"]`; `lot.tsx` reuses `parkedCarsQuery()`. Realtime handlers use `setQueryData` on the payload, with the existing full refetch kept as the fallback path.
- Empty states gate on `isFetched`/`isPending` rather than `length === 0`; loading uses static skeleton rows (no spinners) so layout height is stable.
- Router: `defaultPreload: "intent"` in `src/router.tsx`, plus an idle-time `router.preloadRoute` pass over `/`, `/pickup`, `/lot`, `/profile`. `defaultPreloadStaleTime` stays 0 so preloading never serves stale data.
- Auth gate in `src/routes/index.tsx` renders the shell skeleton instead of the centered "Loading…" div. The 6-second stale-session watchdog and local sign-out fallback in `src/lib/auth-context.tsx` are untouched.

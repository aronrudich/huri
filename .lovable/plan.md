# Why Huri gets stuck, and how to fix it

## What the video shows

The profile screen paints its frame (header, tab bar, "Actions") but the content underneath never arrives: the dealership name is blank and the roster reads "ROSTER (0) — No matches." A few seconds in, the status bar switches from Wi‑Fi to 5G, and only then does the real content appear (Ontario JCD, ROSTER (46)). So nothing crashed — the screen was waiting on a request that never came back or never failed.

## Cause

This is the classic "phone changed networks / dozed off mid-request" failure, and Huri currently has two places where such a request can hang forever:

1. **Requests with no time limit.** Database reads that go through the shared cache have a 10-second ceiling and retry themselves. But several screens still load data with a direct request written inline — profile (roster, dealership name, avatar), the car page, a thread, pickup details, car history, the pending gate. Those have no time limit, no retry, and no error state: if the reply never comes, the screen just sits there empty until the app is force-quit.
2. **Requests that go through our own server have no time limit either.** The inbox directory and the messaging recipient list are fetched that way. A dropped Wi‑Fi connection leaves that call in flight forever, and because the app treats it as "still loading", the refresh that fires when you come back to the app is folded into the dead request instead of starting a new one — so waking the phone or pulling to refresh doesn't rescue it.

That matches "it happens on any and every page" — every page has at least one of these.

## The fix

**1. Put a time limit and retry on every read, everywhere**
Give every request the same ceiling the cached reads already have (about 10 seconds), including the ones that go through our server. A request that doesn't answer in time fails, and the app retries it instead of waiting forever.

**2. Move the leftover screens onto the shared cached loading**
Profile (roster, dealership, avatar), the car page, thread view, car history and the pending gate get converted to the same cached, self-retrying loading the inbox and lot already use. Coming back to a screen then paints the last known data instantly and refreshes in the background.

**3. Cancel and restart stale work when the app wakes up**
When the app comes back to the foreground or the network reconnects, abandon anything still in flight from before and start fresh, so a request stranded by a network switch can't keep the screen hostage.

**4. Show a way out instead of a blank screen**
If a read fails or times out, the screen shows a short "Couldn't load — Retry" line rather than a silent empty state, so nobody has to guess whether to wait or restart.

## What I'm not changing

No changes to claiming, notifications, the pickup rules, roles, permissions, wording, or the database.

## Technical notes

- Export the existing `timeoutSignal` helper from `src/lib/queries.ts` and apply it to every `supabase.from(...)` read in `src/routes/*` and `src/components/*`; wrap `getDirectory` / `getMessageRecipients` server-fn calls in a `Promise.race` timeout (server fns don't accept an abort signal) so `directoryQuery` / `messageRecipientsQuery` can fail and retry.
- New query definitions for the leftover inline loads: `["profile-roster"]`, `["dealership", id]`, `["car", id]`, `["thread", threadId]`, `["car-events", ro]`, replacing the `useEffect` + `useState` fetches in `profile.tsx`, `park.tsx`, `thread.$threadId.tsx`, `CarHistory.tsx`, `PendingGate.tsx`. Realtime handlers keep using `setQueryData` with the existing refetch fallback.
- In `useRealtimeRecovery` (`src/lib/realtime-recovery.ts`), call `queryClient.cancelQueries({ type: "active" })` before `invalidateQueries` so an in-flight dead request is replaced rather than deduped against.
- Keep `retry: 2` with the existing backoff; add `retry` to mutations that read on mount only where already present. No change to `refetchOnWindowFocus` / `refetchOnReconnect`, the persisted cache in `query-persist.ts`, or the auth watchdog in `auth-context.tsx`.
- Error UI: a small shared inline "Couldn't load — Retry" block reusing `ListSkeleton`'s placement, gated on `isError` so loading still shows skeletons.

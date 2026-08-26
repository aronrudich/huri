# One 9 AM list for 14-day cars, plus a fix for the "won't load until I restart" problem

## 1. Why you got multiple 14-day lists today (verified)

The 14-day check is scheduled to run **every hour, on the hour**. Each run picks up whichever cars just crossed the line and sends its own inbox message and push. That's exactly the drip you described.

## What changes

- The check runs **once a day at 9:00 AM Pacific** (year-round, so it follows daylight saving correctly).
- A car qualifies once it has sat **14 days or more** (336+ hours) at its location, which naturally lands every car in the 9 AM list within the 336–360 hour window you described.
- You get **one message per day**, listing every qualifying car in it (RO#, tag#, model, location, notes, days parked, parked-since date) with a count in the first line, and **one push notification** ("3 cars parked 14+ days") instead of one per car.
- No qualifying cars that morning = no message and no notification at all.
- Recipients stay exactly as they are today (Admin role only).
- Each car is still marked as alerted, so it won't reappear in later lists.

## 2. Things not loading until you restart the app

This is fixable and it's a real bug, not just how it works. Two causes, both about coming back to a phone that went to sleep:

- **The live connection dies while the app is in the background.** iOS suspends the websocket that pushes new messages and pickups. When you reopen the app the connection is dead and never rebuilt, so the screen keeps showing whatever it had. Force-quitting is what rebuilds it — which matches your workaround exactly.
- **A request that was in flight when the phone slept never finishes or fails.** With nothing to time it out, the screen stays on the old data (or a skeleton) forever instead of retrying.

The fix:

- On every return to the app (and whenever the network comes back), tear down and rebuild the live connections and refresh the data on screen. This is the piece that removes the need to force-quit.
- Give every read a timeout with automatic retry, so a request killed by sleep fails fast and re-runs instead of hanging.
- If the live connection drops mid-use, retry it in the background with a light gentle backoff, and fall back to a periodic refresh while it's down, so the screen is never more than a few seconds behind.

Nothing is sacrificed: no change to claiming, notifications, roles, approvals, copy, layout, or the database for this part. Worst case is a couple of extra small refreshes when you open the app.

## 3. Full code download

After these changes are in, I'll package the current source as a downloadable zip in the chat, same as before.

## Technical notes

- Migration: reschedule `huri-stale-car-alerts` from `0 * * * *` to `0 16,17 * * *`; the handler exits unless the current `America/Los_Angeles` hour is 9, which gives a true 9 AM Pacific run across DST. `huri-archive-stale-pickups` and `huri-unclaimed-reminder` are untouched.
- `src/routes/api/public/hooks/stale-cars.ts`: group qualifying cars by dealership, build one digest message body per dealership, insert one `messages` row per recipient, send one push per subscription, then mark all included cars' `stale_alerted_at`. Cutoff stays `now() - 14 days` on `located_at`; only mark cars that were actually delivered.
- New `src/lib/realtime-recovery.ts` (mounted once in `__root.tsx`): on `visibilitychange` → visible and on `online`, call `supabase.realtime.disconnect()`/`connect()` and `queryClient.invalidateQueries({ type: "active" })`; bump a channel-generation value in context so route-level channels re-subscribe.
- Route channels in `index.tsx`, `pickup.tsx`, `lot.tsx`, `thread.$threadId.tsx` add the generation value to their `useEffect` deps and handle `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED` in the `subscribe` callback.
- QueryClient in `src/router.tsx`: explicit `refetchOnWindowFocus: true`, `refetchOnReconnect: true`, `retry: 2`; query fns get an `AbortSignal.timeout(10_000)`-style guard so suspended requests reject rather than hang. Persisted cache behavior is unchanged.

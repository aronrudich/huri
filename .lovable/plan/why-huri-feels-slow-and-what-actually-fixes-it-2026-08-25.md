# Why Huri feels slow, and what actually fixes it

Yes, it's fixable. The database is not the problem — I checked the slowest queries and every one runs in single-digit milliseconds against small tables (433 cars, 323 messages, 44 profiles). The delay is in how many network round trips happen before a screen can paint, and how much weight rides along with them.

## What I verified

1. **Nothing is remembered between app launches.** The query cache lives in memory only, so every cold start re-fetches messages, directory, roles, pickups and cars from scratch before anything but a skeleton appears.
2. **The inbox's two biggest reads take the long way around.** `getDirectory` and `getMessageRecipients` are server functions: phone → our server → database. Each one also runs a separate lookup for your dealership first, so that's two sequential database calls per request, on top of the extra hop.
3. **Profile photos are embedded in those responses.** Avatars are stored as base64 image data directly on the profile row (up to ~58 KB each, ~197 KB total today for 6 photos). The directory payload carries every photo of every employee, every time. With 44 people all having photos that becomes well over 1 MB per fetch.
4. **The app code is re-downloaded/re-validated on every cold start.** The service worker handles push only and deliberately caches nothing, so the white screen before "Huri" appears is the browser fetching the app itself.
5. **Startup is already partly optimized** — the stored session and cached profile paint immediately — so the remaining cold-start wait is app download plus the fetches above.

## The fix

**1. Remember data across launches (biggest perceived win)**
Persist the query cache to local storage. On open, the inbox, pickup list and lot paint from the last known data instantly and refresh in the background. Same behavior as today, minus the wait.

**2. Stop shipping photos inside the directory**
Serve avatars as their own small cached images instead of base64 inside every list response. New uploads go to file storage and the row stores a URL; existing base64 photos are migrated once so nobody loses a picture. The browser then caches each photo once instead of re-downloading all of them with every list fetch. Directory responses drop from hundreds of KB to a few KB.

**3. Remove the extra hops on the inbox reads**
Fold the dealership lookup into a single query so each read is one database call instead of two, and fetch the directory and recipients in parallel with (not after) the profile load. Same data, same permissions.

**4. Trim what each read pulls**
Ask for the columns actually rendered instead of `*` on cars and pickups, and cap the inbox at the messages actually shown. Purely payload size; no behavior change.

## What I am deliberately not doing

- **No offline/app-shell caching in the service worker.** You ruled this out before and I still agree: its failure mode is "the app didn't update after we shipped a fix" while people are relying on it. Items 1–4 get most of the benefit without that risk.
- No changes to claiming, notifications, roles, permissions, approvals, routes, copy, or any wording.

## Technical notes

- `persistQueryClient` with a localStorage persister in `src/router.tsx`, max age ~24h, versioned key so a schema change invalidates it cleanly.
- Avatars: new bucket-backed upload in `EditProfileSheet.tsx` replacing `toAvatarDataUrl`'s data URL; one-time migration of the 6 existing base64 rows; `Avatar.tsx` unchanged since it already renders from a URL.
- `directory.functions.ts`: drop the separate `callerDealership` round trip in `getDirectory` / `getMessageRecipients` by scoping with a single joined query; keep `requireSupabaseAuth` and admin-client usage as-is.
- Column narrowing in `queries.ts` (`parked_cars`, `pickup_requests`) and message limit reduced from 500 to what the inbox renders.
- No migrations beyond the avatar backfill; no RLS or grant changes.

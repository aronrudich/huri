# Bottom bar stays put, claim anything, faster startup

## 1. Bottom tab bar no longer drifts

Today the bar is `position: fixed` at the bottom of the page and the whole page scrolls in the browser window. On iPhone Safari the browser's own address bar shrinks and grows while you scroll, and fixed elements ride along with it — that's the movement in the videos.

Fix: switch the app to a fixed-height shell.

- The page wrapper becomes a full-height container (`100dvh`) that does not scroll itself.
- The content area inside it becomes the scrolling region.
- The tab bar sits at the bottom of that shell, so it is pinned to a box that never changes size and cannot ride the URL bar.
- Applied to every tabbed screen (Inbox, Pickup, Lot, plus any page that renders the tab bar) so it behaves identically everywhere.
- Safe-area padding is kept so the bar clears the home indicator.

## 2. Anyone can claim any submission

- Remove the role filter that hides certain submission types (parts from some valet roles, non-shuttle items from Shuttle, etc.). Every employee sees the full pickup list.
- The Claim / "On it" button is available on every submission type: car pickup, staged, parts, shuttle, park.
- Everything else about claiming stays as-is: one claim at a time with the 1-minute cooldown, claimed items leave the list 20 minutes later, colors per type unchanged.

## 3. Why it feels a split second slow, and what to change

There is a real, fixable cause — not just "how it works". On every load the app does this in strict sequence before drawing anything:

1. Read the stored session.
2. Ask the server to re-verify the user (network round trip).
3. Load your profile row (second network round trip).
4. Only then hide the "Loading…" screen and render the page.
5. The page then starts its own queries (messages, directory, cars).

So you always wait for two server round trips staring at a blank loading screen.

Changes:

- Trust the locally stored session for the first paint: show the app immediately and re-verify the user in the background. If verification fails, the app falls back to the sign-in screen as it does now.
- Cache the last known profile locally and hydrate from it instantly, then refresh it in the background so roles/permissions stay correct.
- Start the screen's data fetches at the same time as the profile load instead of after it.

Result: the app paints right away and fills in data as it arrives, instead of holding a loading screen for two round trips. Remaining delay is network latency for the actual message/car data, which will now stream in behind a rendered UI.

## Technical notes

- Layout: shell wrapper `h-[100dvh] overflow-hidden flex flex-col` + inner `flex-1 overflow-y-auto overscroll-contain`; `BottomBar` moves out of `fixed` into the shell footer. Touch `src/components/BottomBar.tsx`, `src/routes/index.tsx`, `src/routes/pickup.tsx`, `src/routes/lot.tsx`.
- Claim: `canSeeKind` in `src/lib/roles.ts` returns true for all roles/kinds; drop the parts-role condition in the pickup list gating. `claim_pickup_request` already has no role check, so no migration is needed.
- Startup: in `src/lib/auth-context.tsx` set session + `loading = false` from `getSession()`, run `getUser()` verification asynchronously, and persist/read the profile from `localStorage` keyed by user id. Keep the existing stale-session watchdog and local sign-out fallback.

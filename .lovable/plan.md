# Make every phone pick up the corrected Cancel rules

## What I checked
- **The live app is correct.** I downloaded the version running at huri.lovable.app right now. It hides full **Cancel** from Valets and Valet Supervisors, and shows **Cancel claim** only on the valet's own claim.
- **All 6 valet accounts** (Valerie, Tristan, Clyde, Isai, Raul, Jesus) are stored exactly as "Valet" / "Valet Supervisor", so the check matches them.
- **The server blocks it too.** If a valet taps Cancel on an old screen, the database refuses: "Valets can only cancel their claim, not the whole request." Unclaiming someone else's claim is also refused. So no valet can actually cancel a request anymore, even with the button showing.

## Why the button is still there
That phone is running an **old copy of Huri**. When Huri is added to the home screen, iPhone keeps the old copy in memory until the app is fully closed (swiped away) and reopened. Huri has no "new version available, refresh" check today, so a phone that stays open in the background never gets fixes we publish. That's why this keeps coming back after each fix.

## The fix
1. **Automatic update check.** Whenever Huri is opened or brought back to the front (and every few minutes while open), it quietly checks whether a newer version has been published. If yes, it reloads itself to the new version.
   - It won't reload while someone is typing in a form or has a photo/camera open; it waits until they're back on a list screen.
2. **Version stamp on the Profile page** (small grey text at the bottom, e.g. "Version Oct 15, 8:10 AM"). You can glance at any employee's phone and know if it's current.
3. Publish once. After that, every phone updates itself the next time it's opened.

## Right now, before the fix is published
Have the valet swipe Huri closed completely and reopen it. The Cancel button will be gone.

## Not changing
- No change to who can cancel, claim, the 60-minute removal, reminders, locations, reports, or wording.
- No offline caching. Huri still always loads fresh from the server.

## Verification
- Publish, keep an old copy open in a test browser, publish again, and confirm it reloads to the new version on its own.
- Sign in as a valet and confirm: no Cancel on any card; Cancel claim only on their own claim.

## Technical details
- Inject a build ID at build time (Vite `define`, e.g. `__BUILD_ID__`) and serve it as a static `/version.json` from `public/` generated at build.
- New `src/lib/app-update.ts`: on `visibilitychange` → visible, on `pageshow`, and every 5 min, fetch `/version.json?ts=…` with `cache: "no-store"`; if the ID differs from the running one, `location.reload()`. Defer while a route is a form screen (`/pickup-new`, `/park-request`, `/compose`, `/thread/*`, edit sheets open) by checking a simple "busy" flag; reload on the next navigation to a list screen.
- Mount the checker once in `src/routes/__root.tsx` (client-only, inside `useEffect`).
- Show the build ID on `src/routes/profile.tsx`.
- No database or permission changes; `enforce_pickup_cancel_permissions()` is already live and correct.

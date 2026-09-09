# Photos on the Log Vehicle page, camera only, tidier car page

## Photos when logging a new vehicle

The Log Vehicle page (the one with RO Number, Location, Car Model, Notes) currently only shows the Photos section once a full 6-digit RO has been typed, so on a fresh blank form it looks missing. Change it to always show the Photos section, right under Notes:

- Tapping "Add Photo" before an RO is entered still works: the photo is held on the page and attaches automatically when the vehicle is logged.
- Photos taken after a valid RO is typed attach immediately, as today.
- Held photos show as thumbnails and can be removed before saving.

## Camera only

- Remove the "Choose Photo" (photo library) button everywhere the Photos section appears.
- Rename "Take Photo" to "Add Photo"; it opens the camera directly.

## Car info page cleanup

Remove the "Pickup" and "Stage" buttons from the car info page. Those actions stay available from the Actions menu / pickup list as before. Save Changes, Delete Car, and Car Has Been Picked Up stay.

## About credits

Photos are cheap. Storing and serving images counts as backend usage, which draws on the monthly Cloud allowance included with every plan (20 credits/month) before touching your regular credits. A shrunk photo is roughly 200-400 KB, so hundreds of photos a month is a very small amount of storage and traffic. Taking photos costs nothing extra per photo in AI terms — there is no AI involved. The main cost driver would be many thousands of photos being viewed repeatedly; typical lot usage will stay well inside the free allowance.

## Technical details

- `src/components/CarPhotos.tsx`: drop the library file input and its button; single camera input (`capture="environment"`), label "Add Photo". Support a pending mode when `ro` is empty — keep `File[]` in state, expose an imperative/callback way for the parent to flush them after insert (parent passes `onPending` or uses a ref with `uploadPending(ro)`).
- `src/routes/park.tsx`: render `CarPhotos` unconditionally in the form; on successful log/save, flush pending photos with the saved RO. Remove the Pickup/Stage button block (~lines 255-272) and now-unused `canStage`/`staged` refs only if nothing else uses them.
- Other forms already using `CarPhotos` (`pickup-new.tsx`, `wash.tsx`, `parts.tsx`, `park-request.tsx`) inherit the camera-only change; keep their existing RO-gated placement.

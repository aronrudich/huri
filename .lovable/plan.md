# Car photos

Let anyone (except spectators) snap or upload photos onto a car, and make it obvious anywhere that car shows up that a photo is attached.

## Taking / adding photos

- On the car info page (the page you reach from the lot list, search, or the Flagged Cars list) a new "Photos" section sits right next to Notes.
- Buttons: "Take Photo" (opens the phone camera directly) and "Choose Photo" (camera roll / files).
- A car can hold many photos. Each new one is added, not replacing the old.
- Photos are also addable while submitting a pickup, stage, park, wash or parts request, so whoever spots the issue can attach it in the moment.
- Anyone who can add a photo can also delete one, from the full-screen viewer.
- Spectators see photos but get no add/delete buttons.
- Each photo records who added it and when, shown under the photo when opened.

## Making an attached photo impossible to miss

Wherever a car appears — pickup list cards, stage/parts/wash cards, the lot list, search results, Flagged Cars, the bring-me screen, and the car info page — a car with photos shows a small photo thumbnail with a bright glowing ring that softly pulses, plus a count badge when there are several.

- Tapping the thumbnail opens the photo full screen immediately, without opening the car page first.
- Full-screen viewer: swipe left/right between photos, pinch/tap to close, delete button, and "who added it" caption.
- On list rows the glow stops pulsing once that person has opened the photos for that car, so it keeps drawing attention until seen but doesn't strobe forever.

## Photos travel with the RO

Photos attach to the RO number, like the wash mark, so they follow the car through location moves and later pickups. A photo attached at submission time is visible to the valet claiming the request.

## Notes

Photos are automatically shrunk on the phone before upload (long edge ~1600px, JPEG) so they load fast on the lot's connection, with a size cap per photo.

## Technical details

- New storage bucket `car-photos` (private), with signed/proxied reads through an existing-style public image route so images cache well.
- New table `car_photos`: `dealership_id`, `ro_number`, `storage_path`, `uploaded_by`, `created_at`. RLS: tenant-scoped read for approved users; insert/delete for active, approved, non-spectator employees. GRANTs for `authenticated` + `service_role`.
- Storage RLS on `storage.objects` scoped to the `car-photos` bucket with the same rules.
- Photo counts fetched per visible RO set in the existing list queries (`pickup.tsx`, `lot.tsx`, `flagged.tsx`, `bring-me.tsx`, `wash.tsx`, `parts.tsx`) and cached with the existing query layer; realtime subscription on `car_photos` so a new photo lights up on other devices.
- New components: `CarPhotos` (add/list/delete section), `PhotoBadge` (glowing pulsing thumbnail), `PhotoViewer` (full-screen swipeable, modeled on `AvatarViewer`).
- "Seen" state for the pulse stored locally per user/photo id.
- Client-side resize via canvas before upload; log a `photo` event into `car_events` on add/delete so it shows in car history.

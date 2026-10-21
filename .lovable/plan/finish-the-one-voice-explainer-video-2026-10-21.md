# Finish the one-voice explainer video

## Where things stand
- The Business page still plays the older video, the one with the mismatched voice at 0:47.
- A corrected draft (v10) was rendered, but the job stopped before it was checked. It has no web version yet and isn't on the site.

## Steps
1. Review v10 against your brief: one narrator the whole way through, 1.25x speed with natural pitch, logo + "Time Is Money" at the start and end, and the ETA privacy section showing "Confirm Arrival Time", "I'm already here" and "Linked to RO #193482" with no personal info fields. Also check that scenes flow evenly with no stretched parts, and that the music sits quietly under the voice.
2. If anything is wrong, re-render it as v11. Earlier versions stay untouched.
3. Make the web version and a cover image at a normal file size (about 20 MB).
4. Swap the Business page video to the new version, then test playback on desktop and phone, including full screen.
5. Send you the final video to listen to before you publish.

## Technical details
- Upload the MP4, WebM and cover to the CDN as new versioned asset pointers. Point the shared Business-page player in src/routes/auth.tsx at them.
- Check the result by measuring frames and audio loudness. Only you can judge how the voice actually sounds.

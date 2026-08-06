# Real SV lot map + fix the missing Map button

## Why the Map button looks missing

The button is only rendered when the pickup's spot is an SV number. Any pickup whose spot is unknown, CP, BL, Bay, or custom shows no Map button — which is most of the current test pickups. Fix: always show the button on car pickups, placed between the time/claimed text and Cancel, and disable it (greyed) when the car isn't in an SV spot.

## The map becomes the real photo

Use the aerial lot photo you uploaded as the actual map instead of a drawn grid.

- Host the photo as an app asset and render it inside a vertically scrollable container.
- Overlay 49 rows x 3 columns of invisible, tappable stall regions aligned to the painted grid in the photo, sized big enough to tap comfortably on mobile.
- Color states drawn on top of the photo: filled stall = translucent red, open stall = no color (photo shows through), the pickup's stall = translucent blue.
- Each stall shows its number in bold white with a dark outline so it stays legible over the pavement.
- Tapping an occupied stall opens the same car popup as today. Tapping an open stall does nothing.
- Live updates: the map reads the same realtime car data as the lists, so colors change as cars are parked/claimed.
- Width fits the screen on mobile and is capped on desktop; the scroll happens inside the map area so the header and bottom tabs stay put.

Where it appears: the SV tab of the Lot page (no blue highlight there) and the fullscreen map opened from a pickup card (that car's stall in blue). CP and BL keep their lists.

## Numbering note

The painted numbers in the photo have a few duplicates/typos (64-66 appear twice, 103 twice, 124/128/129 row). The overlay will number stalls sequentially 1-147 top to bottom, left to right, which matches how Huri stores spots. Tell me if any physical stall number should differ from that sequence.

## Technical notes

- Upload the photo via the asset CLI, reference it by its CDN URL in `src/components/LotMap.tsx`.
- `LotMap` gets rebuilt as: relative container with the image at natural aspect ratio + absolutely positioned stall buttons using percentage top/left/width/height derived from the grid bounds in the photo; percentages calibrated once against the image and verified with a screenshot pass.
- `src/routes/lot.tsx` and `src/routes/pickup.tsx` keep their current props; search filtering on the SV tab dims non-matching stalls rather than removing them, so the photo geometry stays intact.

# Fit the pickup map on one mobile screen

## What's wrong

The map overlay opened from a pickup card currently uses two different renderings: on mobile it shows the tall aerial-photo map inside a scrolling area (so the bottom spots fall below the fold), while desktop shows a fitted, non-scrolling grid. That scrolling mobile version is why the map looks cut off.

## The fix

Mobile gets the same "fits the screen" treatment desktop already has:

- Render the whole SV lot (1-147) as a fitted grid that always sizes itself to the visible area between the overlay header and the bottom of the screen. No scrolling anywhere in the overlay.
- Keep the vertical orientation on mobile: 3 columns across, 49 rows down, numbers running bottom-to-top, left-to-right so spot 1 sits at the bottom-left like the real lot.
- The pickup's spot stays highlighted blue, filled spots red, staged checkered, open spots clear — same colors as now.
- Numbers shrink to fit but stay bold and readable; the map stays non-interactive in this overlay (it's a look-up snapshot).
- Desktop overlay is untouched, and the Lot tab's interactive photo map is untouched.

## Technical notes

- `src/routes/pickup.tsx`: replace the mobile branch of the map overlay with the same fitted `LotMap` used on desktop (`staticView`), dropping `overflow-y-auto` in favor of `overflow-hidden` and a single container that flexes to the remaining height.
- `src/components/LotMap.tsx`: in `staticView`, the mobile grid should mirror numbering bottom-to-top within each row group (currently only the desktop grid mirrors), and stall text size is tuned so 147 cells stay legible at phone height.
- No data, query, or notification changes.

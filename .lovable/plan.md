# Fit the whole SV lot map on one mobile screen

## What's wrong

On mobile, the map that opens from a pickup card still lets rows keep a fixed minimum height, so the grid grows taller than the screen and the last spots (136-147) fall below the fold behind the bottom tab bar.

## The fix

- The map grid sizes itself to the space available between the overlay header and the bottom tab bar, so all 147 spots are on screen at once.
- No scrolling anywhere in the overlay.
- Rows shrink as needed; spot numbers scale down but stay bold, centered, and legible.
- Numbering, colors (blue pickup, red filled, checkered staged, clear open), and the non-interactive behavior stay exactly as they are.
- Desktop overlay and the Lot tab's interactive map are untouched.

## Technical notes

- `src/components/LotMap.tsx` (`staticView` branch): drop `overflow-y-auto` for `overflow-hidden`, replace the mobile grid's `minmax(13px, 1fr)` rows with plain `1fr` (and `min-h-full` with `h-full`), and reduce the mobile cell text to a smaller fixed size with tight leading so numbers fit inside ~11px tall rows.
- `src/routes/pickup.tsx`: keep the overlay a flex column and reserve bottom-bar height on the map container so the grid's available height excludes the tab bar instead of rendering underneath it.
- No data, query, sorting, or notification changes.

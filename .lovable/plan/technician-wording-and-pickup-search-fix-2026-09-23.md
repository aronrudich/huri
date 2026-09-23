# Technician wording and pickup search fix

## What will change

- In the technician Actions menu, change **Add Car to Huri** to **Update Location**.
- On the vehicle/location form, change the bottom submit button from **Log Vehicle** to **Save**.
- Fix the pickup-list search so an RO shown on the pickup list can still be opened even if the saved car list is stale or still loading.

## Search behavior

- Keep the normal search results for cars already loaded in Huri.
- Also include matching active pickup-list submissions by RO number.
- If a pickup-list match has an RO, tapping it opens the vehicle/location page for that RO, just like a regular car search result.
- Avoid showing a false **No cars match** message while there is a matching pickup card on the screen.

## Technical details

- Update the technician-only label in `TopActions` without changing the actual action destination.
- Update the non-edit submit text in `park.tsx` from `Log Vehicle` to `Save`.
- In `pickup.tsx`, merge search results from the loaded car rows and visible pickup submissions, de-duplicated by RO.
- The video shows RO **190596** on the pickup list while exact RO search says no match; the database has a saved car row for RO **190596**, so this fix treats the pickup row as a reliable fallback when the car cache misses it.

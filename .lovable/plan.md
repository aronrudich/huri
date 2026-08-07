# Stage/pickup sync, car popup actions, and the pickup map fix

## 1. Staged status on the lot map

Root cause found in the code: the map's blue "on the pickup list" set is built from every active request, and staged submissions are active requests — so a staged car turns blue instead of checkered, and nothing clears the car's staged flag when a stage is canceled. Also, submitting a real pickup for an already-staged car copies the staged flag onto the new request, so it keeps behaving like a stage.

Fixes:

- **Cancel a stage → spot goes back to red.** Canceling a staged entry in the pickup list clears the car's staged flag (and restores its spot, as cancel already does), so the map spot returns to plain red.
- **Pickup on a staged car → blue.** A normal pickup submission is never marked staged, and it clears the car's staged flag, so the spot flips from checkered to blue.
- **Checkered but readable.** Soften the checker to a light grey/white pattern with a smaller tile, and put the spot number on a solid pill so it stays crisp.
- **Staged spots stay checkered while parked.** Staged requests are excluded from the blue set and drive the checkered set instead.
- **60-minute rule.** Claimed staged entries drop off the list 60 minutes after being claimed, exactly like other pickups (same shared timer — verified, no separate path).

## 2. One Stage button only

Remove the Stage/Staged toggle from the car form's top-right header. The header keeps only the shared Park / Pickup / Stage actions. Staging a car happens through the Stage submission; un-staging happens only by pressing Cancel on that staged entry in the pickup list.

## 3. Pickup and Stage buttons in the car info view

On the car detail view opened from a map spot, add two buttons under Save Changes and Delete Car:

- **Submit Pickup** — opens the normal pickup form prefilled with this car's RO number.
- **Submit Stage** — opens the same form in stage mode, prefilled the same way.

The Stage button is hidden when the car is already staged, and only appears for advisors, managers, and directors (same rule as the header Stage button). Both go through the exact same submission flow as the top-right buttons, so notification behaviour is identical.

## 4. Mobile pickup map overlay gets cut off

The fullscreen map opened from a pickup card squeezes the whole lot into the visible area with scrolling turned off, which clips everything past spot 135 on mobile. Change it so the overlay body scrolls vertically and the map renders at its natural height, with the highlighted spot scrolled into view when it opens. Desktop still shows the whole lot at once. The Lot tab's map is untouched.

## Technical notes

- `src/routes/lot.tsx`: include `is_staged` in the active-pickup query; skip staged requests when building `pickupSpots` and feed a new `stagedSpots` set to `LotMap`.
- `src/routes/pickup.tsx`: on Cancel, also write `is_staged: false` to the matching `parked_cars` row for staged entries. In the map overlay, replace `overflow-hidden` with `overflow-y-auto` and drop `staticView` on mobile (keep the fitted static grid at `md+`).
- `src/components/LotMap.tsx`: retune the `CHECKER` gradient to muted tokens at a smaller `backgroundSize`, and wrap the stall number in a solid pill for staged stalls; allow the highlighted stall to scroll into view in the scrollable overlay.
- `src/routes/pickup-new.tsx`: insert `is_staged: isStage` only (drop the `|| !!car?.is_staged` inheritance); non-staged submissions continue clearing `parked_cars.is_staged`.
- `src/routes/park.tsx`: delete the header stage toggle and its `staged` state usage there; add the two link buttons to `/pickup-new` (`search: { staged: true }` for stage) below Delete Car, gated on `editing && ro`.
- No database changes.

# Why RO #187399 shows "Unknown" on the pickup list but "Bay" on the car page

## What's actually happening

I checked this exact car's history. It is not a glitch on the car page — the two screens are showing two different moments in time:

- Before Micah's pickup was claimed, car 187399 had no known location (it was set to Unknown on Sep 9 by an earlier pickup).
- The pickup card saves the location the car was at **the moment it was claimed** — that was "Unknown".
- Claiming a technician pickup then moves the car to Bay, which is what the car page shows now.

So the card is frozen on the old "Unknown" while the car itself has since moved to Bay. This happens for any car whose location was Unknown at claim time, which is why you see it regularly.

## The fix

On the pickup list, when a claimed card's saved location is "Unknown" but the car does have a real current location, show that current location instead. Cards with a real saved spot keep showing that spot, so a valet still sees where the car was picked up from.

Result: RO #187399 would read "Bay · Technician Bay" on the pickup list, matching the car page, and future Unknown-at-claim cars will fill in as soon as their location is known.

## Technical details

- `src/routes/pickup.tsx` (~lines 334-346): claimed pickups currently force `displayCar = undefined` and use `p.lot_position` only. Change the claimed branch to `p.lot_position && p.lot_position !== "UNKNOWN" ? p.lot_position : (liveCar?.lot_position ?? "UNKNOWN")`, and keep the existing notes/`hasCarRecord` behavior otherwise.
- Frontend only; no database or trigger changes. The claim routine keeps storing the pre-move snapshot as it does today.

# Destinations move when a submission leaves the list — cards keep the submit-time location

## What you're describing vs. what the app does now

Right now the car's location is changed the moment a submission is **claimed**:

- Tech pickup → Bay (with the tech's name in notes)
- Staged → CP, staged flag cleared
- Wash → Wash
- Customer pickup → Unknown
- Parts → no change

Claiming also overwrites the submission's stored location with the car's live location, which is why cards could drift away from what was true at submit time.

## The change

1. **Nothing about the car changes on claim.** The car stays exactly where it was, so the valet can still find it during the 20 minutes the card sits claimed on the list.
2. **When the submission disappears from the list** (20-minute auto-archive or a manual complete), the destination is applied:
   - Technician / Shop Foreman pickup → **Bay**, tech's name in notes. If the car isn't in Huri at all, it's still created at Bay as it is today.
   - Staged submission → **CP**, staged flag cleared.
   - Wash request → **Wash**.
   - Customer pickup → **Unknown** (car has gone home).
   - Parts requests → no car change.
3. **Cards keep showing the location recorded at submit time**, unchanged for the life of the card — claiming no longer rewrites it. The stale-Bay exception for tech pickups stays: a tech pickup whose snapshot says Technician Bay shows "Location unknown". Park requests still show Technician Bay.
4. **Someone re-parking the car wins.** If the car has been moved after the submission was claimed, the archive step leaves that newer location alone instead of overwriting it.
5. **Cancel is unchanged** — it restores the car's spot and clears the staged flag.

The car's own info page always shows its real current location, as today.

## Technical notes

- Migration: strip the destination `UPDATE public.parked_cars` block and the `lot_position`/`car_model` overwrite out of `claim_pickup_request()` (keep status/claimed_by/claimed_at plus guards; keep `car_model` backfill only when the request has none).
- Migration: extend `archive_stale_pickups()` to apply the destination per kind/source (`WASH`, `CP` + `is_staged = false`, `BAY` + notes, `UNKNOWN`) guarded by "car has not moved since claim" — compare `parked_cars.located_at` against `claimed_at`.
- Migration: rename/extend `add_tech_car_on_pickup_complete()` into the single `AFTER UPDATE ... status -> completed` handler that both creates the missing Bay row and applies the destination to an existing row, so a manual complete from the client and the server sweep behave identically.
- `src/routes/pickup.tsx`: the client-side `archiveExpired` sweep sets status only; destinations come from the trigger. Display already reads the `p.lot_position` snapshot — no display change needed.

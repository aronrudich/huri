# Pickup cards show the location as of submission time

## What's happening

You're right on both counts, and there are two separate causes.

1. Cards for unclaimed submissions currently show the car's **live** location, not the one recorded when the submission was made. So if the car gets moved (or a valet drops it in a bay) after submission, the card silently changes. Every submission already stores a location snapshot at submit time — the list just isn't trusting it.

2. The "Technician Bay" you're seeing was in fact the car's recorded location at submit time: once a valet brings a car to a bay, the car's record stays "Technician Bay" until someone parks it again. If the tech then submits another pickup for that same car, the snapshot honestly reads "Technician Bay" — which is useless to the valet, since a tech pickup means the car is out in the lot.

## The fix

- Every submission card (pickup, technician pickup, park, parts, wash, staged) shows the location recorded at the moment it was submitted, and never changes afterward. Claimed cards already behave this way; unclaimed ones will match.
- Exception kept as-is: a **Park request** legitimately means the car is at the tech's bay, so that one keeps showing Technician Bay.
- If a technician pickup is submitted for a car whose record still says Technician Bay (leftover from its last bay visit), the card shows "Location unknown" instead — because the car can't be in the bay if the tech is asking for it. The valet then searches for it as with any unknown-location car.
- The car's own info page keeps showing its real current location; this change only affects what the pickup list cards display.

Nothing changes about claiming, notifications, ordering, archiving, or reports.

## Technical notes

- `src/routes/pickup.tsx`: drop the `displayCar?.lot_position` preference in `effectiveSpot` so all statuses use `p.lot_position` (the submit-time snapshot); keep `displayCar` only for model/notes fallbacks. Recompute `hasCarRecord` off the snapshot plus live-row existence so "not in Huri" still reads correctly.
- Same file: when `kind === 'pickup'` and `isTechSource(p.source_role)` and the snapshot is `BAY`, treat the spot as `UNKNOWN` for display (blockers/map affordances follow the same value).
- Submission forms are unchanged — `pickup-new.tsx` already snapshots the car's location, and `park-request.tsx` intentionally sends `BAY`.

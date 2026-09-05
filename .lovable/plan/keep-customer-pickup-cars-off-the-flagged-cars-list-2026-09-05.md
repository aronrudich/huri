# Keep customer-pickup cars off the Flagged Cars list

## Answer first: no, this was not already the case

I checked the live data. Right now 70 cars sit on the Flagged Cars list, and 39 of
them already had a customer (blue) pickup that was claimed and cleared off the
pickup list. They should never have been there.

Why it happens today: when a blue pickup is claimed, the car's location is set to
"unknown" and the car stays in Huri. The 14-day clock restarts from that moment,
so 14 days later it gets flagged again — even though the customer drove it home.
Red technician pickups are different and stay eligible, which is correct.

## 1. Blue pickups take the car off the 14-day list for good

- A car whose most recent blue customer pickup was claimed and cleared is never
  flagged again, at any point.
- Red technician pickups, parts, wash, park and stage requests are unaffected.
- If a valet later parks that same car in a real spot again, it counts as back on
  the lot and the 14-day clock starts fresh from that new location.
- Cleanup: the 39 cars currently on the list that were already picked up are
  removed from the list right away.

## 2. New "Car Has Been Picked Up" button on the car page

- A red-free, full-width button at the bottom of the car page (below Pickup /
  Stage), shown only when an existing car is open.
- Pressing it asks for a quick confirm, then does exactly what a submitted →
  claimed → cleared blue pickup does: records a completed customer pickup on the
  car's history with the person who pressed it, sets the car's location to
  unknown, and takes it off the Flagged Cars list.
- Spectators don't see the button.
- Afterwards you land back on the pickup list with a short confirmation.

## Technical details

**Flagged eligibility rule** (no schema change needed): a car is excluded when a
`pickup_requests` row exists with the same `ro_number`, `kind = 'pickup'`,
`is_staged = false`, `source_role` not in (`Technician`, `Shop Foreman`), status
`completed`, and `coalesce(completed_at, claimed_at) >= parked_cars.located_at`.
Re-parking bumps `located_at` past that timestamp, so the car naturally becomes
eligible again.

- `src/routes/api/public/hooks/stale-cars.ts`: before stamping `flagged_at`,
  select candidate ids (`located_at <= cutoff`, `flagged_at is null`,
  `flag_dismissed_at is null`) plus completed customer pickups for those ROs, and
  update only the ids that fail the exclusion rule.
- One-off `run_sql`: clear `flagged_at` on currently flagged cars matching the
  exclusion rule (39 rows), leaving `flag_dismissed_at` untouched.
- `src/lib/queries.ts` / `flaggedCarsQuery`: unchanged — the list already reads
  only `flagged_at`-stamped rows.
- `src/routes/park.tsx`: new button under the Pickup/Stage row, hidden for
  spectators. Handler inserts into `pickup_requests`
  (`ro_number`, `car_model`, `lot_position` = saved spot, `kind: 'pickup'`,
  `status: 'completed'`, `requested_by`/`claimed_by` = current user,
  `claimed_at`/`completed_at` = now, `source_role` = current role,
  `advisor_name` = current user's name), then updates `parked_cars` for that id
  with `lot_position: 'UNKNOWN'`, `is_staged: false`, `flagged_at: null`. The
  existing pickup/parked-car triggers write the history entries, so the car's
  history reads the same as a normal claimed-and-cleared pickup.
- Existing `track_car_location_age()` already clears `flagged_at` when a location
  changes, so no migration is required.

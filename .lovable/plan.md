# Auto-add technician cars to the lot list at the bay

## What happens today

When a technician submits a pickup for a car that is not in Huri yet, the request shows "Spot unknown". When a valet claims it, the app tries to move that car's location to BAY — but only if the car already exists in the lot list. If it doesn't exist, nothing is created, and once the request drops off the pickup list the car is nowhere in the system.

Confirmed in the database: the claim step only updates an existing car row; there is no step that creates one.

## What we'll change

When a technician (or shop foreman) pickup request finishes and leaves the pickup list, and that car is not in the lot list yet, Huri adds it automatically:

- Location: `BAY` (generic — no bay number, since the form doesn't ask for one)
- RO number and car model carried over from the request
- Note carried over, plus the tech's name so people know whose bay it is
- The car's history shows it was added by the completed tech request

This applies only to technician/shop-foreman pickups. Advisor (customer) pickups are left alone — those cars are going home with the customer, so they should not reappear on the lot list.

It also applies whether the request was completed by hand or auto-archived 20 minutes after claim.

Cars added this way behave like any other car at BAY: they show in the lot list, can be edited, and their 14-day clock starts from the moment they're added.

## Also covered

If the car already exists, behavior is unchanged (it moves to BAY on claim, as it does now).

Parts and shuttle requests never create a car.

## Technical detail

Extend the existing `car_events_from_pickups` path with a new `AFTER UPDATE` trigger function on `public.pickup_requests` (security definer) that fires when `status` transitions to `completed`:

- Guard: `kind NOT IN ('parts','shuttle')`, `source_role IN ('Technician','Shop Foreman')`, `ro_number` present.
- If no `parked_cars` row exists for `(dealership_id, ro_number)`, insert one with `lot_position = 'BAY'`, `car_model = NEW.car_model`, `notes = COALESCE(NEW.car_notes || ' — ', '') || 'Bay — ' || advisor_name`, `parked_by = NEW.claimed_by`.
- Existing `parked_cars` insert triggers handle spot validation, dealership stamping, and the history entry.
- Because `archive_stale_pickups()` performs the same status update, auto-archived requests are covered by the same trigger with no extra code.
- No frontend changes required; the realtime `parked_cars` subscription in `src/routes/pickup.tsx` and the lot list pick up the new row automatically.

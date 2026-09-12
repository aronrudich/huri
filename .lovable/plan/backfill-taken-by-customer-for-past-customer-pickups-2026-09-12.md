# Backfill "Taken by Customer" for past customer pickups

## What I found in the live data

- 555 cars currently sit at "Unknown".
- 518 of them have a finished customer (blue) pickup in their history — those are the ones that went home with the customer.
- 514 of those had no newer parking after that pickup; 4 were parked again at some
  point but are now back at Unknown.

## What I'll change

- Every car that is currently at "Unknown" and has a finished customer pickup in its
  history gets its location set to "Taken by Customer" (all 518).
- Cars at Unknown with no customer pickup (37) stay Unknown — they simply have no
  recorded spot.
- Cars parked in a real spot, at CP, BL, a bay, or wash are untouched, even if they
  had a customer pickup earlier.
- Nothing else changes: history entries, reports, the pickup list and Flagged Cars
  all stay as they are (these cars are already kept off Flagged Cars).

## Technical details

One-off data update, no schema change:

```sql
UPDATE public.parked_cars pc
SET lot_position = 'TAKEN'
WHERE pc.lot_position = 'UNKNOWN'
  AND EXISTS (
    SELECT 1 FROM public.pickup_requests r
    WHERE r.ro_number = pc.ro_number
      AND r.dealership_id = pc.dealership_id
      AND r.kind = 'pickup' AND r.is_staged = false
      AND COALESCE(r.source_role, '') NOT IN ('Technician', 'Shop Foreman')
      AND r.status IN ('completed', 'picked_up')
  );
```

- Run through the data tool (not a migration); `validate_spot` passes `TAKEN`
  through unchanged, and `track_car_location_age` will refresh `located_at` /
  clear `flagged_at` as it does for any location change.
- App code already renders `TAKEN` as "Taken by Customer" everywhere, so no code
  edits are needed.

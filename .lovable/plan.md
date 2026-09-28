# Automatic moves credited to Huri, and ETA button placement

## What changes
1. **RO 190594 history fixed:** the Sep 23, 1:35 PM "SV 131 → BAY" entry will show **Huri** instead of Joleen.
2. **Automatic moves always show Huri:** when a submission leaves the list and Huri moves the car (tech pickup → Bay, wash → Wash, staged → CP, customer pickup → Taken), that history line is credited to Huri. It won't matter whose phone happened to have the Pickup list open. Moves people make by hand still show their own name.
3. **Button order on the car page:** "Copy Customer ETA Link" moves to just below "Car Has Been Picked Up" and above History.

Note: today's 7:25 AM "UNKNOWN → BAY" on 190594 looks like the same kind of automatic move. The fix will check it and correct it too if it was automatic.

## Technical details
- Data fix (run_sql): `update car_events set actor_id = null where id = 'b56e82c3-3272-4643-bfd5-bafb3b2e9fa7'`. Also check `0024326a-...` (Sep 28 14:25) against its matching pickup's completion time and null it if it matches.
- Migration: in `add_tech_car_on_pickup_complete()`, run `set_config('huri.system_move','on', true)` before its `UPDATE`/`INSERT` on `parked_cars`, then reset it after. In `car_events_from_parked_cars()`, use `CASE WHEN current_setting('huri.system_move', true) = 'on' THEN NULL ELSE auth.uid() END` as the actor for every event. The auto-created BAY car also records `parked_by = NULL`.
- `src/routes/park.tsx`: move the Copy Customer ETA Link block to sit after the "Car Has Been Picked Up" button and before `<CarHistory>`.
- Check with `bunx tsgo --noEmit` and the build log.

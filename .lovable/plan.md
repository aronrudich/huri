# Keep Reports fast as car history grows

The Valet points tab replays every car move ever recorded each time Reports opens. It does this to work out how many cars were blocking each SV car at the moment someone claimed it. As history grows, Reports will get slower.

## Fix
- Only replay the moves that matter: the moves inside the chosen dates, plus each car's last known spot just before the start date.
- Point totals stay exactly the same. Only the loading gets faster.

## Technical details
- Add a SQL function `lot_snapshot_at(_dealership uuid, _at timestamptz)` that returns the latest logged/moved/deleted event per RO before `_at` (DISTINCT ON ro_number ORDER BY created_at desc). Run it as the caller, with dealership scoping.
- Add an index on `car_events (dealership_id, created_at)`.
- In `getReport`, start `carAt`/`spotCount` from the snapshot at `start`, then page `car_events` with `gte(start)` and `lt(end)`.
- Check that the point totals match the current code for one sample week.

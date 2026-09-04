# Backfill the Flagged Cars list and confirm deletions are shared

## What I checked

- 226 cars in Huri have been sitting in the same location for 14+ days.
- None of them are on the Flagged Cars list yet, because the daily 5 AM check
  hasn't run since the feature went in. The check itself has no cutoff on how far
  back it looks, so once it runs it does pick up cars from any date (oldest
  location date in the system is Aug 7).
- Removing a car from the list is already global: the "removed" mark is stored on
  the car itself, not per person, so one swipe clears it from everyone's list.

## 1. Include all historical cars now

Rather than wait for tomorrow's 5 AM run, flag every car that already qualifies
in one pass. That puts all 226 cars on the list immediately, oldest first, and
the daily 5 AM check continues adding cars as they cross 14 days.

## 2. Make a removed car come back if it moves again

Today, once a car is swiped off the list it can never return — even if it's moved
to a new spot and sits there another 14 days. When a car's location changes, its
flag and its "removed" mark are cleared, so it re-qualifies from the new date.
This is what "removed from the list, not from Huri" should mean over time.

## 3. Deletions stay shared

No change needed — confirmed the removal is stored on the car and every viewer
reads the same field. One person removing a car removes it for all.

## Technical details

- One-off data update (run_sql, not a migration): set `flagged_at = now()` on
  `public.parked_cars` where `located_at <= now() - interval '14 days'` and both
  `flagged_at` and `flag_dismissed_at` are null.
- Migration: update `public.track_car_location_age()` so that when
  `lot_position` changes it also sets `flagged_at = NULL` and
  `flag_dismissed_at = NULL` alongside the existing `located_at` /
  `stale_alerted_at` reset.
- `src/routes/api/public/hooks/stale-cars.ts` and `flaggedCarsQuery` need no
  changes; the hook has no lower date bound and the query already pages past the
  1,000-row read cap.

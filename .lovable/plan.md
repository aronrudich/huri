# Wash confirmation by Car Wash only, plus a Flagged Cars tab

## 1. Only the Car Wash employee can mark a car washed

Today any employee who moves a car out of Wash stamps it as washed. That
changes:

- A wash is recorded only when the person making the move is in the **Car Wash**
  role, and only when they set the new location to **CP** or **BL**.
- Any other person moving the car out of Wash (or moving it to a different
  location) records nothing — no green check.
- Existing wash marks stay as they are; the new rule applies going forward.

The green "Washed" check keeps appearing in the same two places (pickup list and
car info) — it just means something stricter now.

## 2. New "Flagged Cars" tab replaces the 14-day inbox digest

- New item in the Actions menu titled **Flagged Cars**.
- One long list, oldest first, of every car untouched for 14 days or more —
  all locations included, nothing excluded.
- The list is refreshed once a day at **5:00 AM Pacific** (instead of 9 AM).
- No more Huri inbox message and no more push notification for 14-day cars.
- Swipe a row to remove that car from the Flagged Cars list. This only clears it
  from the list — the car stays in Huri, in its spot, fully searchable. A removed
  car can be flagged again if it later crosses a new 14-day mark.
- Access: Admin, Service Manager, Service Director, General Manager, Spectator.
  Everyone else doesn't see the menu item, and the page turns them away.
- Spectators can open and read the list but cannot swipe cars off it.

## 3. Spectators see everything Admin sees, but stay read-only

Spectators get the same visibility as Admin — pickup list, lot, car info,
history, roster, Reports, Flagged Cars — with every action disabled: no
submitting, no claiming, no canceling, no messaging, no editing, no role
changes, no deletes, and no swiping cars off the flagged list.

## Technical details

**Migration**
- `parked_cars`: add `flagged_at timestamptz` and `flag_dismissed_at timestamptz`,
  plus an index on `(dealership_id, flagged_at)`.
- Rewrite `public.record_wash_on_leaving_wash()`: record a wash only when
  `OLD.lot_position = 'WASH'`, `upper(NEW.lot_position) IN ('CP','BL')`, and the
  acting user's `profiles.role_name = 'Car Wash'`. Otherwise return NEW untouched.
- `public.track_car_location_age()`: on a location change also clear
  `flagged_at` and `flag_dismissed_at` so the 14-day clock restarts cleanly.
- Reschedule cron job `huri-stale-car-alerts` from `0 16,17 * * *` to
  `0 12,13 * * *` (5 AM Pacific across DST).

**Server**
- `src/routes/api/public/hooks/stale-cars.ts`: keep the token check, change the
  hour guard from 9 to 5, drop the location filter entirely (all locations,
  including CP and UNKNOWN), remove all message-insert and push code, and simply
  stamp `flagged_at = now()` on qualifying cars where `flag_dismissed_at IS NULL`
  and `flagged_at IS NULL`. `stale_alerted_at` is left alone (legacy).

**Client**
- `src/lib/roles.ts`: new `ActionId` `"flagged"`, `FLAGGED_ROLES` = Admin,
  Service Manager, Service Director, General Manager, Spectator with
  `canViewFlagged()`; append `flagged` alongside `reports` in `actionsForRole`
  for those roles; Spectator returns `["reports", "flagged"]`.
- `src/components/BottomBar.tsx`: label "Flagged Cars", hint "Parked 14+ Days",
  route `/flagged`.
- New `src/routes/flagged.tsx`: header with logo + back arrow like other pages,
  React Query read of `parked_cars` where `flagged_at IS NOT NULL` and
  `flag_dismissed_at IS NULL`, ordered by `located_at` ascending; each row shows
  RO #, tag #, model, location, days parked, notes; rows wrapped in the existing
  `SwipeRow` (delete action hidden for Spectators) whose handler sets
  `flag_dismissed_at = now()` and `flagged_at = NULL`; empty state when nothing
  qualifies; non-permitted roles get a short "no access" message.
- `src/lib/queries.ts`: add a `flaggedCarsQuery()` with the standard timeout
  signal and a 60s stale time.

**Note on RLS:** the dismiss write goes through the existing
`parked_cars update by active employees` policy. If Spectator is excluded from
`private.is_active_employee`, that write is already blocked at the database level
too, which matches the read-only rule.

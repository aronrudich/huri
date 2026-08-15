# Technician actions, auto sign-in, and full car history

## 1. Skip sign-in for returning users
Anyone with a valid saved session lands on the inbox instead of briefly seeing the sign-in screen. The sign-in page redirects immediately once the session is confirmed, and the loading state stays until that decision is made.

## 2. Technician-only button set
Technicians (Technician and Shop Foreman) get exactly three actions:

- **Bring Me** — opens a small chooser screen with two large, side-by-side buttons: **Car** and **Parts**. No instructions, just the two choices. Picking Car opens the existing pickup form; picking Parts opens the existing parts form.
- **Park My Car** — opens the existing "Park" (valet-comes-to-my-bay) form.
- **Add Car to Huri** — opens the existing "New" car-logging form.

Every other role keeps its current action list unchanged.

## 3. Rename "New" everywhere
The action label "New" becomes **Add Car to Huri** for all roles.

## 4. Search placeholder
All search bars (pickup list, lot/map, inbox) read **Search RO#**.

## 5. Technician form: no car model
The car model field is removed from the forms technicians submit — the model is already tied to the RO.

## 6. Unclaimed reminder timing
The second push to valets for an unclaimed submission fires at **5 minutes** instead of 10.

## 7. Full history for every car
Each car gets a **History** section at the very bottom of its detail screen (and in the car info popup), listing every action ever taken on that RO, newest first:

- Logged into Huri / edited / deleted
- Location changes (from → to)
- Pickup, Stage, Parts, Park, Shuttle submissions
- Claims, cancellations, and automatic archiving/relocation
- Notes captured with each action

Each entry shows what happened, who did it, and the date and time.

## Technical notes

- **Auth**: in `src/lib/auth-context.tsx` / `src/routes/auth.tsx`, redirect to `/` as soon as a verified session exists; keep the existing watchdog but drop the desktop network-failure workaround messaging (the earlier failure was a corporate block, not a bug).
- **Actions**: `src/lib/roles.ts` gains `bringme` as a technician action id; `actionsForRole` returns `["bringme", "park", "new"]` for tech roles. `LABELS.new` becomes "Add Car to Huri". New route `src/routes/bring-me.tsx` renders the two-button chooser linking to `/pickup-new` and `/parts`.
- **Forms**: hide/remove the Car Model field in `src/routes/pickup-new.tsx`, `src/routes/park.tsx`, `src/routes/park-request.tsx`, and `src/routes/parts.tsx` when the signed-in role is a technician role (model still resolved from the existing `parked_cars` row on submit).
- **Reminder**: `REMIND_AFTER_MS` in `src/routes/api/public/hooks/unclaimed-reminder.ts` → 5 minutes; cron schedule adjusted to run every minute so the 5-minute mark is honored.
- **History**: new `public.car_events` table (`ro_number`, `event_type`, `detail`, `notes`, `actor_id`, `dealership_id`, timestamps) with GRANTs, RLS (tenant read for approved users, insert by active employees), plus triggers on `parked_cars` (insert/location change/delete) and `pickup_requests` (insert/claim/cancel/complete) so nothing has to be logged manually from the client. `PickupHistory` in `src/routes/park.tsx` is replaced by a `CarHistory` component reading `car_events` merged with pickup rows, rendered last on the page.

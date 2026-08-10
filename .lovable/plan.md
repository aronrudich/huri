# Role-based action menu, Shuttle roles, and form/state fixes

## 1. Top-right actions become one dropdown

Replace the row of pill buttons in the header with a single dropdown trigger (larger on desktop). Items appear in this exact order per role:

- Valet: no dropdown — just a single "New" button.
- Advisor: Pickup, New, Stage, Shuttle
- Technician / Shop Foreman: Pickup, Parts, Park, New
- Shuttle: nothing.
- Everyone else (managers, directors, GM, etc.): Pickup, New, Stage, Parts, Shuttle, Park

Meaning of each item (kept distinct):
- New — log a car into the system (existing car form).
- Pickup — customer pickup request.
- Stage — car finished, customer not there yet.
- Parts — parts run to a bay.
- Park — ask a valet to come to the technician's bay and park their car. New request type, notifies valets, shows in the pickup list.
- Shuttle — shuttle request (see below).

## 2. Shuttle request + Shuttle roles

New shuttle request form with: Customer name (required), Phone number (required), RO number, notes. Submitting notifies every Shuttle and Valet & Shuttle user.

Pickup list:
- Shuttle submissions render green, show customer name, tappable phone number, and RO#, and open a detail view on tap.
- Shuttle role: sees only shuttle submissions; gets only shuttle notifications; no action buttons.
- Valet & Shuttle role: sees everything a Valet sees plus shuttle submissions, but not Parts submissions; receives both Valet and Shuttle notifications.
- Existing Shuttle behavior stays limited to shuttle only.

Both new roles are added to the role list so they show up in role changes/approvals with the right permissions.

## 3. Location picker fixes (vehicle form)

- Clearing the SV spot number input will only clear that field; the Location dropdown keeps showing "SV · Spots 1–147".
- Choosing a location persists on the first attempt instead of snapping back to "Choose A Location".

Cause: the picker currently mirrors its own state off the parent's value, and the parent value is empty until a spot number is typed, so the sync effect wipes the chosen location. Fix: the picker owns the selected location, and the parent value only feeds it on real external changes.

## 4. Technician pickup → Bay

When a technician-submitted pickup is claimed, that car's location becomes "Bay" with the technician's name attached, applied automatically 60 minutes after the claim (same timing rule already used for staged cars moving to CP).

## 5. Card wording

On pickup cards, the location line reads "Location: SV 3" — the "Parked at: Spot" wording is removed.

## Technical notes

- `TopActions` in `src/components/BottomBar.tsx` becomes a role-driven dropdown; new routes `src/routes/shuttle.tsx` (shuttle request) and `src/routes/park-request.tsx` (valet-to-bay park request); `src/routes/park.tsx` stays the "New" car-logging form.
- Migration: insert `Shuttle` and `Valet & Shuttle` roles; add `customer_name`, `customer_phone` to `pickup_requests`; extend `kind` with `shuttle` and `park`; add `bay_pending_at`/reuse claim time for the Bay relocation.
- `src/lib/push.functions.ts`: shuttle fan-out to Shuttle + Valet & Shuttle; valet fan-out expanded to include Valet & Shuttle.
- `src/routes/pickup.tsx`: role-based list filtering, green shuttle styling, detail sheet, location label change.
- `src/routes/api/public/hooks/stale-cars.ts` (cron): move claimed tech pickups to Bay after 60 minutes alongside the existing staged→CP job.
- `src/components/LocationPicker.tsx`: decouple internal choice state from parent value.

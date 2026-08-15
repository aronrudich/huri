# Bring Me screen polish, history coverage, 14-day alerts

## 1. Bring Me screen matches the screenshot
- Page title "Bring Me" at the top left, with the small three-dot accent under it.
- Two equal cards side by side: white/surface cards with rounded corners and a soft shadow, blue icon on top, black bold label under it ("Car" and "Parts").
- No filled blue card and no outlined variant — both cards look identical.
- Tapping Car opens the pickup form; tapping Parts opens the parts form (unchanged).

## 2. Action menu hint text
- "Bring Me" hint becomes "Car or Parts".
- "Park My Car" and "Add Car to Huri" show no hint text at all (label only, for every role that sees them).

## 3. Car history covers everything
The History section on a car keeps every action ever taken on that RO, newest first, each entry showing what happened, who did it, and the date/time, plus any notes. Coverage is audited and gaps filled so it includes:
- Added to Huri, edited (RO#, tag#, model, notes), deleted
- Location changes (from → to), including automatic moves to CP or Bay and spot displacement when another car takes the spot
- Every submission type: Pickup, Stage, Parts, Park, Shuttle — with who submitted and their role
- Claims (who claimed, from what location), cancellations, completions, automatic 20-minute archiving
- Unclaimed reminders sent
- Notes attached to any of the above

## 4. 14-day parked-car alert goes to the Service Manager only
Only users with the Service Manager role receive the 14-day inbox message from Huri and the push notification. Managers, directors, foreman, and GM no longer get it. Easy to widen later.

## Technical notes
- `src/routes/bring-me.tsx`: heading + dot accent; both tiles use the surface/card style with `text-primary` icons and `text-foreground` labels; keep the header logo, Actions menu and back arrow.
- `src/components/BottomBar.tsx`: `HINTS.bringme` → "Car or Parts"; make `HINTS` values optional and render nothing for `park` and `new`.
- History: verify trigger coverage in `car_events_from_parked_cars` (tag/RO/model edits currently unlogged) and `car_events_from_pickups`; add a migration extending those trigger functions to log field edits and reminder sends, and log the `archive_stale_pickups` auto-move/auto-complete via `log_car_event`. `src/components/CarHistory.tsx` gains titles for the new event types.
- `src/routes/api/public/hooks/stale-cars.ts`: replace the `MANAGEMENT_ROLES` recipient list with `["Service Manager"]`.

## Credit estimate (answered in chat, no code change)

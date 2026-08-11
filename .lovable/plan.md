# Map button on car info, stage notifications, shuttle options, action labels

## 1. Map button on the car info screen

- Add a "Map" button at the bottom of the car screen (next to Pickup / Stage).
- Pressing it opens the same full-lot, non-interactive SV map used by the pickup list, with this car's spot highlighted blue and everything fitting on one screen.
- The button only appears when the car is in a numbered SV spot. CP, BL, Bay, unknown, and custom locations have no map, so no button shows there.

## 2. Stage submissions now notify valets

- Submitting a Stage sends the valet notification like any other request (in-app alert + push).
- Priority stays as it is today: unclaimed stages sit below every other unclaimed submission. Once a stage is claimed it keeps its claimed position and is no longer pushed down by newer submissions.

## 3. Stage → CP only if the car hasn't moved

- Today a claimed stage is moved to CP 60 minutes after the claim.
- New rule: if the car's location is changed by anyone after the claim (for example re-parked into SV 5), the submission simply leaves the pickup list at the 60-minute mark and the newer location is kept. No CP overwrite.
- If nothing changed the location, it lands in CP as before.

## 4. Shuttle request form

- Add a Pickup / Drop Off choice at the top.
- When Pickup is chosen, an Address field appears.
- Nothing in the shuttle form is required anymore (customer name, phone, RO, address, notes are all optional).
- The shuttle card and detail view show the type (Pickup or Drop Off) and the address when present.

## 5. Action menu descriptions

Each dropdown item shows its label with a smaller subtitle underneath/beside it:

- Pickup — Bring Me A Car
- New — Log Car Into Huri
- Stage — Bring Car To CP
- Parts — Bring Me Parts
- Park — Park Car For Me
- Shuttle — Pickup/Dropoff Customer

Row height and text size adjust so every label + description fits without wrapping awkwardly. Roles keep their existing item sets.

## 6. Admin layout matches managers

- Admin sees the same app layout and buttons as a manager, including the blue Stage button on the car screen. Admin-only extras (join and role-change approvals) stay as they are.

## Technical notes

- `src/routes/park.tsx`: add a `Map` button + fullscreen overlay rendering `LotMap` with `staticView` and `highlightSpot`, gated on the saved location matching `SV <n>`; broaden `canStage` to include Admin (use a shared helper in `src/lib/roles.ts` instead of the local regex).
- `src/routes/pickup-new.tsx`: always call `sendPickupAlert` (including stages), passing a `staged` flag; `src/lib/push.functions.ts` and `src/routes/pickup.tsx` in-app alert stop suppressing staged rows and use a "Car staged for CP" title.
- Stage→CP guard: compare `parked_cars.located_at` against the pickup's `claimed_at` — if `located_at > claimed_at`, complete the request without touching `lot_position`. Applied in both the client archive effect in `src/routes/pickup.tsx` and the `archive_stale_pickups` database function (migration).
- Shuttle: migration adds `shuttle_kind` (`pickup`/`dropoff`) and `customer_address` to `pickup_requests`; `src/routes/shuttle.tsx` drops all validation gates; `sendShuttleAlert` passes the new fields; `src/routes/pickup.tsx` shuttle card/detail render them.
- `src/components/BottomBar.tsx`: `LABELS` becomes label + description pairs rendered as two lines in the dropdown row.

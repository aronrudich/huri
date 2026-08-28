# Wash: new location, new request type, new role

## 1. "Wash" becomes a real location

- The Location picker gains a **Wash** option (alongside SV, CP, BL, Bay, Other, Unknown).
- A car sitting at Wash shows "Wash" everywhere a location shows: pickup cards, car info popup, lot list, search badges.
- Wash holds any number of cars (like CP and BL).

## 2. Cars carry a permanent "Washed" mark

- When a car leaves Wash — the car wash employee (or anyone) sets the car's new location — Huri records that this RO# was washed, with the date and who moved it.
- The car's info popup shows a green check with "Washed" and the date. The wash record is tied to the RO#, so it stays with that car forever, even if the car is later moved, re-parked, or requested again.
- The car's history gets a "Washed" entry too, same as every other action.
- If the same RO# goes through Wash again later, the date updates to the most recent wash.

## 3. "Wash" request in the action menu

- New **Wash** item in the top-right action menu for everyone except valets (advisors, technicians, shop foreman, managers, directors, GM, Admin). Valets don't submit washes — they respond to them.
- Submitting a Wash request works like the other requests: RO # (required, 6 digits) plus notes. Valets get an instant notification, and the request shows in the pickup list with its own vibrant pill color (distinct from Pickup blue, Park green, Tech red, Parts amber) — teal.
- The card shows the car's current location and blocking info like other car requests, so the valet can find it.
- When a valet claims a Wash request, the car's location changes to **Wash** immediately in the backend (same pattern as tech pickups → Bay and staged → CP), while the card keeps showing the original location so the valet can still find the car.

## 4. New "Car Wash" role

- `Car Wash` is added to every role list: registration, request-role-change, and the manager/owner change-role sheet, plus the roles table used for approvals and group messaging.
- Car Wash permissions: they can search any car, open car info, and set a car's location (the "Add Car to Huri" / relocate flow) — that's how the washed mark gets set. They do not get the Wash submit button and don't receive pickup-queue notifications, only messages.

## Technical notes

- Migration: insert `Car Wash` role; add `'wash'` to accepted `pickup_requests.kind`; new `public.car_washes` table (`dealership_id`, `ro_number` unique per dealership, `washed_at`, `washed_by`) with GRANTs + RLS (tenant read, active-employee insert/update); trigger on `parked_cars` UPDATE where `OLD.lot_position = 'WASH'` and the new location differs → upsert `car_washes` and `log_car_event(..., 'washed', ...)`; update `claim_pickup_request` so `kind = 'wash'` sets the car's `lot_position` to `WASH`; keep `WASH` out of the single-car-per-spot unique index; allow `WASH` in `validate_spot()`.
- `src/lib/lot.ts`: `WASH` in `normalizeSpot`, `locationChoice`, `isCustomSpot`, `locationLabel` ("Wash"), `spotBadge` ("W"), no blocking info.
- `src/components/LocationPicker.tsx`: add the Wash option.
- `src/lib/roles.ts`: `Car Wash` in `ROLE_OPTIONS`; `wash` added to `ActionId` and to `actionsForRole` for all non-valet roles; `Car Wash` gets `["new"]`.
- New route `src/routes/wash.tsx` (mirrors `park-request.tsx`), wired in `BottomBar.tsx` action menu.
- `src/lib/push.functions.ts`: wash fan-out to valets + Admin.
- `src/routes/pickup.tsx`: teal pill, wash label/detail sheet, location + blocking block for wash cards.
- `src/routes/park.tsx` / car info popup: green "Washed · date" line fed by `car_washes`; `src/lib/queries.ts` gains the wash lookup.

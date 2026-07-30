## 1. Tech pickups auto-move to Lot T after 60 minutes

Today the scheduled cleanup job marks every claimed pickup's car location as `UNKNOWN` 60 minutes after claim. Change it so:

- If the pickup was submitted by a **Technician or Shop Foreman**, the car's spot becomes **`T`** (tech lot / bay) 60 minutes after claim.
- All other pickups keep the current behavior (spot becomes `UNKNOWN`).
- Either way the pickup itself is marked completed and drops off the pickup list at 60 minutes, unchanged.

Whoever moves the car later just enters the new spot normally — no extra step for the person who delivered it.

## 2. Spot validation: only 1–147, C, or T

- Accepted values: `1`–`147`, `C`, `T` (plus the internal `UNKNOWN` state).
- Anything else is rejected before submit with the message **"Invalid spot"**.
- Applies to the Park form and any place a spot is edited. The database already enforces the same rule, so this makes the app-side message match.

## 3. Search bar at the same height on every tab

- **Lot tab:** move the search bar above the Lot 1 / Lot C / Lot T buttons so it sits at the same height as the other tabs' search bars; the lot buttons move below it.
- Placeholder text becomes just **"Search"** everywhere (the lot tab currently says "Search by spot, RO #, or model").
- Every search bar (Inbox, Pickup, Lot, Profile) searches the same things: RO numbers, cars (model/spot/notes) and people (name/nickname/role). Results are grouped by type, with the tab's own content listed first.

## 4. Temporarily turn off approval for new accounts

- New signups are approved instantly instead of landing in the pending queue — no waiting during this week's onboarding push.
- Role-change requests still go through you for approval; only join-the-dealership approval is switched off.
- This is a single toggle so it can be switched back on later with one change. The approval queue UI stays in place and simply shows nothing while it's off.

## Technical notes

- Rewrite `public.archive_stale_pickups()` in a migration to branch on `pickup_requests.source_role IN ('Technician','Shop Foreman')` → set `parked_cars.lot_position = 'T'`, else `'UNKNOWN'`.
- Spot validation lives in `src/lib/lot.ts` (`normalizeSpot` / `isValidSpot`); surface a toast "Invalid spot" from `src/routes/park.tsx` and any other spot editor.
- Header reorder in `src/routes/lot.tsx` (swap the tab-button block and the search input block).
- Shared search: reuse `searchCars` and `getDirectory` from `src/lib/directory.functions.ts` in the Pickup and Lot headers the way `src/routes/index.tsx` already does.
- Auto-approve: set `status: 'approved'` in `createConfirmedAccount` (`src/lib/auth.functions.ts`) behind a single `AUTO_APPROVE_SIGNUPS` constant so it's trivial to flip back.

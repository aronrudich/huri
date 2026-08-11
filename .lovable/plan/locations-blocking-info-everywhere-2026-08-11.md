# Locations & blocking info everywhere

## 1. Pickup list shows every location clearly

Today a pickup card only prints a location line when the car has one, and blocking is only calculated for SV spots. Changes:

- Always show a location line on car pickups (customer, tech, park, stage):
  - `SV 3` → shown as is, plus blocking info.
  - `CP · Customer Parking`, `BL · Back Lot`, `Technician Bay`, or the custom text → shown as is with the note "Unnumbered lot — no blocking info".
  - No matching car in Huri → "Not parked in Huri — location unknown", so it reads as missing data rather than a bug.
- Blocking line stays real for SV: lists each blocking car's spot, RO#, and model (1 blocks 2, 2 blocks 3 within each row of three). When an SV spot has no blockers, say "Not blocked" instead of showing nothing.

## 2. Blocking info in the car info popup

On the car screen that opens from a search result or from the map, add a small "Blocking" section under the location:

- SV car: "Blocked by: SV 2 (RO #123456 · Jeep Grand Cherokee)" for each car in front of it, or "Not blocked — clear to pull out".
- SV car that blocks others: also list which spots it is blocking, so the valet knows before moving it.
- CP / BL / Technician Bay / custom / unknown: "Unnumbered lot — no blocking info".

## 3. Service Manager counts as an admin

Service Manager joins the approver group, so Service Managers get join-request and role-change notifications and see the pending-approvals view, and the server accepts their approve/deny/role-set actions. No other role permissions change.

## Technical notes

- `src/lib/roles.ts`: add `"Service Manager"` to `APPROVER_ROLES`.
- `src/lib/lot.ts`: add a helper returning the spots a given SV spot blocks (the reverse of `adjacentSpots`), plus a small `locationLabel(spot)` used by both surfaces.
- `src/routes/pickup.tsx`: render the location block unconditionally for non-parts/non-shuttle cards; branch on `lotOf(spot)` for the blocking text; distinguish "no car record" from `UNKNOWN`.
- `src/routes/park.tsx`: add the blocking section, reusing `carsByPos` already loaded there.
- No database or server-function changes.

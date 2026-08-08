# Map numbering, button color, and staged cars moving to CP

## 1. Desktop map numbers run bottom-to-top

On the desktop/laptop map (both the Map tab and the pickup map overlay), each column of three stalls is currently numbered top-to-bottom, so the bottom-left stall reads 3. It should read 1, with numbers going up each column and then left to right, matching the real lot.

Fix: in the horizontal desktop grid, place each stall in the mirrored row (spot 1 in the bottom row, 2 middle, 3 top) while keeping column order unchanged. Mobile's photo-aligned layout is untouched.

## 2. Stage button color

On submission pages, the Pickup and Stage buttons at the bottom of the car form are styled differently — Stage is a white outlined button. Both become the same solid blue button.

## 3. Claimed staged cars land in the CP lot

When a staged submission is claimed, the car stays where it is for 60 minutes (as today). At the 60-minute mark, when the staged pickup is archived off the list, the car's location becomes CP and its staged flag clears, so it shows up in the CP lot in Huri.

Regular pickups, tech pickups, and parts requests keep their current behavior.

## Technical notes

- `src/components/LotMap.tsx`: give desktop grid cells an explicit `gridRow` of `COLS - ((n - 1) % COLS)` (and matching `gridColumn`) for the horizontal `md:` grid and the `md:` static snapshot grid, so numbering ascends upward per column.
- `src/routes/park.tsx`: Stage link uses the same `bg-primary text-primary-foreground` classes as Pickup.
- `src/routes/pickup.tsx`: in the 60-minute `archiveExpired` sweep, when the expiring pickup has `is_staged` and an `ro_number`, also update the matching `parked_cars` row to `lot_position: 'CP', is_staged: false`, then refresh the car cache.
- `archive_stale_pickups()` database function gets the same behavior so the server-side sweep (used when no one has the app open) also parks claimed staged cars in CP.

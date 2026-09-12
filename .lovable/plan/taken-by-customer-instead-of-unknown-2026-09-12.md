# "Taken by Customer" instead of Unknown

Yes — the change happens at the same moment the blue customer pickup leaves the pickup list (the 20-minute auto-finish or a manual finish), and also when someone presses "Car Has Been Picked Up" on a car page.

## Behavior

- A finished customer pickup sets the car's location to **Taken by Customer** instead of Unknown.
- Everything else is unchanged: technician pickups still go to the bay, staged cars to CP, wash to Wash, parts and park requests don't move the car.
- The label "Taken by Customer" shows everywhere a location is shown: car page, lot list, search results, inbox lists, pickup cards.
- Not a manual choice — it can't be picked by hand when setting a car's location; it only comes from a completed customer pickup.
- On the lot screen these cars stay in the existing catch-all group with the no-spot cars, each row reading "Taken by Customer".
- Cars taken by the customer stay out of the Flagged Cars 14-day list (unchanged — that already keys off the completed customer pickup).
- If a valet later parks the car in a real spot, the new spot wins as it does today.
- Existing cars already sitting at Unknown are left as they are; only pickups finishing from now on get the new label.

## Technical details

New canonical location value `TAKEN`.

- `src/lib/lot.ts`: `normalizeSpot` accepts `TAKEN`; add it to `LocationChoice`; `locationChoice` returns `TAKEN`; `isCustomSpot` returns false for it; `locationLabel` → "Taken by Customer"; `spotBadge` → "C"; `lotOf` → null (no lot tab); no numbered-spot/blocking logic applies.
- Migration updating `add_tech_car_on_pickup_complete()`: the final `ELSE` branch sets `lot_position = 'TAKEN'` instead of `'UNKNOWN'`. Other branches untouched.
- `src/routes/park.tsx`: the "Car Has Been Picked Up" handler updates `lot_position: 'TAKEN'` (still `is_staged: false`, `flagged_at: null`); `setPos` treats `TAKEN` like `UNKNOWN` (empty picker selection) so it isn't offered or re-saved by hand, and the placeholder/duplicate-spot checks treat `TAKEN` as a non-exclusive location.
- `src/routes/lot.tsx`: include `TAKEN` in the same unspotted group as `UNKNOWN`, row subtitle via `locationLabel`.
- `src/routes/inbox.tsx`, `src/routes/pickup.tsx`: display through `locationLabel`, and exclude `TAKEN` from spot-keyed maps the way `UNKNOWN` is excluded.
- `src/components/LocationPicker.tsx`: unchanged (no new option).

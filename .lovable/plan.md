# Search cars from inbox + viewable profiles

## 1. Inbox search — include cars/RO#

In `src/routes/index.tsx`, extend search so typing a query also looks up parked cars (by RO#, spot, model) using the existing dealership-scoped car list.

- Add a new server fn `searchCars` in `src/lib/directory.functions.ts` (auth'd, dealership-scoped) returning `{ id, ro_number, lot_position, make, model, year, color, notes }` filtered by RO# / spot / make / model substring match. Limit ~20.
- In `index.tsx`, when `q` has ≥2 chars, call `searchCars(q)` and render a new "Cars" section above "People" (same style as People). Tapping a car navigates to `/lot` with the RO# preselected (existing lot page already supports search) — pass via `search: { q: ro_number }`.

## 2. Profile view component

Create `src/components/ProfileViewSheet.tsx`: a centered modal (matches the recently-centered popup style) that takes a `userId` and displays:
- Full name (nickname if set)
- Dealership name (join `dealerships` by `dealership_id`)
- Role (`role_name`)
- Phone number (`formatPhone`)
- Email

Add a server fn `getPublicProfile(userId)` in `directory.functions.ts` (auth'd, same-dealership check) returning those fields + dealership name.

## 3. Profile icon in thread header

In `src/routes/thread.$threadId.tsx`, next to the existing phone icon, add a `User` (lucide) icon button. Only show for 1:1 DM threads (thread_id starts with `dm:`), not group threads. Tapping opens `ProfileViewSheet` for the other participant.

## 4. Third "Profile" button in search popup

In `src/routes/index.tsx`, the existing `selectedPerson` popup currently has Message + Call. Add a third "Profile" button (User icon) that opens `ProfileViewSheet` for that person. Keep the three buttons in a row; if width is tight, stack Message full-width on top with Call + Profile split below.

## Technical notes
- No schema changes; all data already exists on `profiles` + `dealerships` + `parked_cars`.
- New server fns follow the existing `requireSupabaseAuth` + `callerDealership` pattern.
- Reuse `formatPhone` from `src/lib/phone.ts`.
- Reuse existing centered-modal styling from the recently-updated popups.

## Files touched
- `src/lib/directory.functions.ts` — add `searchCars`, `getPublicProfile`
- `src/components/ProfileViewSheet.tsx` — new
- `src/routes/index.tsx` — car results section, wire Profile button
- `src/routes/thread.$threadId.tsx` — profile icon in header

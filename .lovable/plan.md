
## What I'll change

### 1. Bigger Huri logo everywhere
- In `src/components/BottomBar.tsx` bump `HuriLogo` from `h-7` to `h-12` (roughly 1.7× larger) so the wordmark + car above the "i" is clearly readable in every page header.
- Give the sticky page headers a bit more vertical padding so the taller logo doesn't get clipped.

### 2. Parts push notifications — only Valet & Parts
- Server (`src/lib/push.functions.ts` → `sendPartsAlert`): already scoped to `role_name = 'Valet & Parts'`. Leave as-is (verified).
- Client (`src/routes/pickup.tsx`): the in-app realtime `notify()` currently fires for anyone whose role is `Valet` on **every** new `pickup_request`, including parts. Filter that listener so it ignores rows where `kind = 'parts'`. Only the server `sendPartsAlert` (which targets Valet & Parts) will produce a push for parts.

### 3. "Cancel" button on every pickup/parts card
- Add a small secondary "Cancel" button on each row in the pickup list (both unclaimed and claimed states, both car pickups and parts).
- Cancel does NOT touch `parked_cars` — the car stays where it is in the lot list. It only sets `pickup_requests.status = 'completed'` (with a `completed_at` timestamp) so the row disappears from the pickup feed. Confirmation dialog before it fires.

### 4. Clear all current cars
- One-time `DELETE FROM public.parked_cars` (via the insert/data tool, not a migration). Pickup history stays intact; only the live lot is emptied.

### 5. Enforce the 60-minute auto-hide for claimed pickups
- The `archive_stale_pickups` cron function already flips claimed → completed after 60 min. Verify the `pg_cron` job is scheduled every minute; if not, (re)schedule it. Also keep the client-side fallback in `pickup.tsx` so tabs left open still hide stale rows even if cron lagged.

### 6. Three-lot model: Lot 1 (1–147), Lot C (unnumbered), Lot T (unnumbered)
- **Spot grammar update** in `src/lib/lot.ts`:
  - Accept exactly `"T"` and exactly `"C"` as valid free-form spots (any car in that lot, no number).
  - Remove `"0"` as an off-lot marker; migrate existing `"0"` and legacy `"UNKNOWN"` off-lot rows to `"T"`.
  - Keep numeric `1–147` for Lot 1. Remove the old `C1–C36` numbered spec (per your message Lot C has no numbers now; if you want the old C1–C36 kept too, tell me and I'll leave that grammar in).
  - `lotOf()` returns `lot1` for numeric, `lotC` for `C`, `lotT` for `T`.
  - `adjacentSpots()` only applies to Lot 1 numeric spots. `C` and `T` have no blockers.
- **DB validation** (`validate_spot` trigger): update to allow `1–147`, `C`, or `T`.
- **Lot page** (`src/routes/lot.tsx`): three tabs — Lot 1, Lot C, Lot T. Lot 1 shows the numbered grid. Lot C and Lot T show a flat list of all cars currently assigned to that lot (no spot numbers, just RO / model / notes). Cross-lot search still auto-switches tabs on match.
- **Park form** (`src/routes/park.tsx`): update the field label and validation error to say "Spot: 1–147, or C for Lot C, or T for Lot T". Spot-conflict duplicate check only runs for numeric spots — many cars can share `C` or `T`.
- **Pickup list**: display `Spot C` or `Spot T` cleanly (no "Spot unknown" fallback for those).

### 7. Any employee's role editable by admins without approval
- In `src/routes/profile.tsx` roster + wherever a user's profile is tappable, allow Manager / Director / Owner roles to open a profile and change `role_name` directly via `ChangeRoleSheet`. This bypasses the pending-approval flow entirely for admin-initiated changes. Regular users still go through the request→approve flow.

### 8. Delete button on every lot-list car
- Currently the delete button lives on the Park form and only shows when we can resolve the row by `ro_number`. Rows without an RO can be tapped but never expose delete.
- Change `src/routes/lot.tsx` so tapping any occupied row opens Park in edit mode by `id` (not just by RO). Update `park.tsx` to accept `?id=<uuid>` as an alternative to `?ro=`, load that record, and always render the Delete button when editing an existing row.

### 9. Downloadable single-file code export
- Bundle the entire project source (excluding `node_modules`, `.git`, build output, `remotion/`, `/tmp`) into `/mnt/documents/huri-source-YYYY-MM-DD.zip` and post it as a `<presentation-artifact>` in the chat so you can download it in one click.

## Explicit non-changes
- Messaging, dealership branding, icons, and other unrelated flows stay untouched.
- Pickup history (`pickup_requests`) is preserved — only live `parked_cars` is wiped.

## Order of execution
1. Small type/grammar changes in `src/lib/lot.ts` + DB `validate_spot` migration + data migration `0 → T` + `DELETE parked_cars` (one insert-tool call after the migration).
2. UI updates: `BottomBar` logo, `lot.tsx` three tabs, `park.tsx` id-based edit + delete, `pickup.tsx` cancel button + parts-realtime filter + display of `C`/`T`.
3. Admin role edit path in profile.
4. Verify cron job scheduled.
5. Build the zip and drop it in `/mnt/documents/`.

## Confirmations before I build

- **Old `C1–C36` numbered spots** — your latest message says Lot C now has no numbered spots. Should I fully drop the old `C1–C36` grammar (any existing rows migrate to plain `C`), or keep both `C` and `C1..C36` valid?
- **`0` → `T` migration** — okay to convert every existing `"0"` and `"UNKNOWN"` `parked_cars` row to `"T"` as part of the wipe? (Since you also want a full clear, this is moot for cars, but I'll apply the same rule to `pickup_requests.lot_position` snapshots so old claimed cards read "Spot T" instead of "Spot 0/Spot unknown".)

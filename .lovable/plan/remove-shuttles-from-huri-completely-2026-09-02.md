# Remove shuttles from Huri completely

## What the last fix actually changed

You were right that the audience lists were already correct. The fix was narrower: some saved phone/device registrations were being permanently rejected by Apple/Google with a "400" error, and Huri kept those dead registrations forever, so those devices failed on every single alert. Now Huri deletes a dead registration (only when at least one other device accepted the same alert, so a real outage can't wipe everyone), and the app re-registers that device automatically the next time the person opens Huri. Net effect: the two devices that failed on all 33 recent pickups stop being permanently broken.

## Shuttle removal

Verified current state: no employee holds `Shuttle` or `Valet & Shuttle`, and there are zero shuttle requests in the database — so nothing real is lost.

### What changes for users
- The Shuttle request screen and its button disappear from the actions menu everywhere.
- `Shuttle` and `Valet & Shuttle` are removed from sign-up, role-change requests, and the admin role switcher. Only `Valet` remains.
- Pickup-list cards, cancel prompts, and Reports labels no longer mention shuttles.
- Notification audiences become one list for every submission type: active, approved `Valet` and `Admin` with notifications on.
- No historical data is deleted; the shuttle columns simply stop being used.

### Technical steps
- Delete `src/routes/shuttle.tsx`; remove the `shuttle` action from `src/lib/roles.ts` (`ActionId`, `SHUTTLE_ROLES`, `isShuttleRole`, role options) and from `src/components/BottomBar.tsx` labels/links.
- Remove `sendShuttleAlert` from `src/lib/push.functions.ts`; drop the shuttle branch in `src/routes/api/public/hooks/unclaimed-reminder.ts` so every kind uses `["Valet", "Admin"]`.
- Strip shuttle rendering from `src/routes/pickup.tsx` (kind pill, drop-off detail, cancel copy) and the `shuttle` label in `src/routes/reports.tsx`.
- Update `VALET_ROLES` to `["Valet"]` and clean up any remaining role expansions.
- Data cleanup: delete the two unused `Shuttle` / `Valet & Shuttle` rows from the roles list (no profiles reference them).
- Leave the `pickup_requests.shuttle_kind` / `customer_address` columns in place (unused) to avoid touching historical rows.

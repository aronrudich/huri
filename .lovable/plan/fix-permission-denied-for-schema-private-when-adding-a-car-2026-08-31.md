# Fix "permission denied for schema private" when adding a car

## What's happening
Adding a car to Huri calls a database routine that assigns the parking spot. I confirmed that routine runs with the signed-in user's own privileges, and that regular signed-in accounts have no access to the internal `private` helper schema it uses to look up your dealership and check that you're an active employee. So the very first check inside it fails and the whole save is rejected with "permission denied for schema private".

The same issue exists in the routine that claims a pickup, so claiming can fail the same way.

## The fix
Re-create both routines so they run with the elevated privileges of their owner (like the other internal Huri routines already do), with a locked-down search path. All existing safety checks stay exactly where they are:

- Still requires an active, approved employee.
- Still scoped to the caller's own dealership.
- Still locks the target spot and asks for confirmation before displacing another car.

No visible change for users beyond adding cars and claiming working again.

## Technical notes
New migration only, no app-code changes:
- `public.assign_lot_position(...)` → `SECURITY DEFINER`, `SET search_path = public, private`, body unchanged.
- `public.claim_pickup_request(uuid)` → `SECURITY DEFINER`, `SET search_path = public`, body unchanged.
- Re-`GRANT EXECUTE` to `authenticated` after replacing, and `REVOKE EXECUTE ... FROM anon, public` so only signed-in users can call them.

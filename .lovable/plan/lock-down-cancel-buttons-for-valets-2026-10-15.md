# Lock down Cancel buttons for valets

## What we found
- The current Pickup List already hides full **Cancel** from Valets and Valet Supervisors, and shows **Cancel claim** only on the valet's own claim. The server already refuses a full cancel from any valet.
- All 6 valet accounts are stored exactly as "Valet" / "Valet Supervisor", so the role check matches them.
- A valet seeing Cancel and Cancel claim on Alex's and Raul's claims means their phone is running an older published version. The fix only reaches phones once it's published.

## Changes
1. Harden the Pickup List so valets fail closed:
   - Valets and Valet Supervisors are checked first and always get no full Cancel, ahead of any manager/owner rule.
   - If a profile hasn't loaded yet, hide Cancel until the role is known, so an old or empty profile can't flash the button.
   - **Cancel claim** shows only when the request is claimed and the claimer is the signed-in person.
2. The unclaim action only resets requests claimed by that person, so it can never touch someone else's claim.
3. Server check: add a database rule so only the claimer (or management) can unclaim a request. Today the server blocks valet full cancels but not unclaiming someone else's claim.
4. Publish so every valet phone gets the corrected buttons.

## Verification
- Sign in as a valet and confirm: no Cancel anywhere; Cancel claim only on their own claim, and it returns the request to the queue.
- Server tests: a valet's full cancel is rejected; a valet unclaiming another person's claim is rejected.
- Advisor, tech/Shop Foreman, and management rules stay the same.

## Technical details
- `src/routes/pickup.tsx`: reorder `canCancel` (valet → false first, `!profile` → false); add `.eq("claimed_by", user.id)` to the unclaim update.
- Migration: extend `enforce_pickup_cancel_permissions()` to reject `claimed → unclaimed` unless `OLD.claimed_by = auth.uid()` or upper management or system (null uid).

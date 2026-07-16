Plan:

1. Make claimed pickup cards keep showing location info
   - When someone presses Claim, Huri will first capture the car’s current spot, model, and notes from the lot record.
   - Then it will mark the pickup as In Progress with that saved spot/model/notes on the pickup request itself.
   - Only after saving that snapshot will it remove the car from the active lot list, so the spot becomes open in the List tab.
   - The pickup card will continue showing Parked at: Spot X after claim, using the saved pickup snapshot instead of the now-deleted lot record.
   - For older claimed pickups that already lost their spot data, the card will still show a location row as Spot unknown instead of hiding the location area entirely.

2. Adjust pickup card display logic
   - Unclaimed pickups: show the latest live lot info when the car still exists in the lot.
   - Claimed/In Progress pickups: show the saved snapshot from the pickup request so the valet still knows where the car was when it was claimed.
   - Keep showing RO#, model, advisor, notes, and blockers when available.

3. Add RO# duplicate protection in Park
   - If a user enters an RO# that already exists in another spot, Huri will warn them before updating it.
   - The warning will explain the RO# is already logged somewhere else and ask them to confirm moving/updating that same RO#.
   - This prevents the same RO# from accidentally existing in more than one parking spot.

4. Strengthen spot duplicate protection in Park
   - If a user enters a designated spot that already has a different RO# in it, Huri will warn them and require confirmation.
   - If confirmed, the existing car in that spot will be freed/moved out of that spot before saving the new car.
   - Spot 0 stays exempt: multiple cars can be in spot 0, and no duplicate-spot confirmation is needed for spot 0.

5. Preserve the intended update behavior
   - Pressing Park with an existing RO# will update that car’s info instead of creating a duplicate row.
   - Re-parking a car from spot 0 into a real spot will not require a spot-0 conflict confirmation, but it will still warn if the new real spot is occupied by another car.

Files expected to change:
- `src/routes/pickup.tsx`
- `src/routes/park.tsx`
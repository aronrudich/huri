## Goal

Replace the old Lot 1 / Lot C / Lot T system with **SV / CP / BL**, while keeping an optional custom location. A claimed pickup must retain its location snapshot on the pickup card for 60 minutes, but immediately release the live parking location so another car can use it.

## Plan

1. **Replace the Spot text field with a location picker**
   - Tapping the field opens a menu with **SV**, **CP**, **BL**, and **Other**.
   - **SV** opens a second compact window for the required number, limited to 1–147.
   - Store and display numbered locations as `SV 42` rather than only `42`.
   - **CP** and **BL** need no number and can contain multiple cars.
   - **Other** opens a free-text location field, preserving special-location support.

2. **Update lot browsing and search**
   - Rename the three lot tabs to **SV**, **CP**, and **BL**.
   - SV lists spots 1–147 and their cars; CP and BL list their cars without numbered spaces.
   - Keep custom locations out of those three tabs, but include them in car/RO/location search results.
   - Update location labels throughout the park form, lot list, search results, and pickup cards.

3. **Preserve SV blocking behavior**
   - Apply the existing three-deep blocking rules only to numbered SV locations.
   - CP, BL, and custom locations never report blockers.

4. **Release live spots immediately on claim**
   - When Claim is pressed, atomically copy the car’s current location/model/notes into the pickup request and immediately clear the live parked-car location to `UNKNOWN`.
   - Keep the saved pickup snapshot unchanged, so the claimed pickup card continues showing its original location for the full 60-minute window.
   - After 60 minutes, mark the pickup completed and remove it from the queue without changing the car’s live location again.
   - Keep cancellation restoration behavior, using the saved snapshot if a pickup is canceled.

5. **Update database validation and uniqueness**
   - Accept `SV 1` through `SV 147`, `CP`, `BL`, `UNKNOWN`, and custom text.
   - Enforce one car per numbered SV location, while allowing multiple cars in CP, BL, UNKNOWN, and custom shared locations.
   - Remove the old delayed rule that moved technician pickups to Lot T after 60 minutes.

6. **Verify the complete flow**
   - Test parking in SV, CP, BL, and Other; invalid SV numbers; spot/RO conflicts; lot tabs and search; SV blockers; claim snapshot retention; immediate live spot release; cancellation; and 60-minute queue expiration.
   - Check the park form and lot/pickup pages at the current mobile viewport and desktop width.

## Technical details

- Update the shared lot helpers so every screen uses one canonical parser/formatter for SV, CP, BL, UNKNOWN, and custom locations.
- Use a database function for claim + snapshot + immediate release so two devices cannot claim or reuse a spot between separate client updates.
- Keep the existing 60-minute archive schedule solely for completing stale claimed requests; it must no longer mutate `parked_cars`.
- Existing numbered records will be migrated from `1`–`147` to `SV 1`–`SV 147`; old `C` records become `CP`, and old `T` records become `BL`.
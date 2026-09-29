# Correct upcoming ETA placement and appearance

## Pickup list behavior
- Treat every customer ETA more than 20 minutes away as an inactive upcoming arrival.
- Place active unclaimed requests first, then claimed/in-progress requests, and place inactive ETA arrivals last—below everything, including claimed cards.
- At exactly 20 minutes before the ETA, automatically move the arrival into the normal active customer-pickup priority and enable **Claim**.
- Keep the existing live countdown so this transition happens without refreshing.

## Upcoming ETA appearance
- Make the entire inactive card almost clear using very low opacity, not the current lightly faded treatment.
- Keep enough contrast to identify the RO, ETA, and activation countdown.
- Keep **Claim** unavailable until activation; retain the disabled countdown control.
- Once active, restore full opacity and the normal customer-pickup styling.

## Verification
- Test three simultaneous groups: normal unclaimed, claimed/in-progress, and an ETA more than 20 minutes away.
- Confirm the inactive ETA is last and nearly transparent.
- Test across the 20-minute boundary and confirm it moves into active priority, becomes fully visible, and can be claimed.
- Confirm spectator accounts remain read-only.

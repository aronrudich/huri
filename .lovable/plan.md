# Claim timer, map colors, approvals, and unknown locations

## 1. Claim cooldown drops to 1 minute

The wait between claims goes from 2 minutes to 1 minute. The countdown on the Claim button and the "wait" message both reflect the shorter time, and the database rule that enforces it across devices is updated to match.

## 2. Claimed cars stay blue on the lot map

Right now claiming a car clears its spot, so its map square stops showing blue. The map will keep showing the spot blue for any car on the active pickup list, claimed or not, using the spot recorded on the submission when the car itself no longer has one. It reverts to normal once the submission leaves the list (archived, completed, or canceled).

## 3. Every new account and role change needs approval

New signups land in the pending queue again instead of being approved instantly, so an Admin, Service Manager, or owner must approve them. Role change requests already work this way and stay unchanged. Approvers keep getting the notification and the pending list on the profile page.

## 4. Unknown location reads simply "Unknown"

Wherever a car has no location — pickup cards, the lot list, the car info screen — the text is just "Unknown" instead of longer phrases like "Not parked in Huri — location unknown" or "Location unknown".

## Technical notes

- `src/routes/pickup.tsx`: `CLAIM_COOLDOWN_MS` → 1 minute; location fallback text → "Unknown".
- Migration: `claim_pickup_request()` cooldown interval → 1 minute.
- `src/routes/lot.tsx`: when resolving a pickup's spot, fall back to `p.lot_position` if the live car row is `UNKNOWN`; unknown-location labels → "Unknown".
- `src/lib/auth.functions.ts`: `AUTO_APPROVE_SIGNUPS` → `false` (pending status + existing admin notification path).

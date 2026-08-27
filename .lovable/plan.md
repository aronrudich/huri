# Pickup destinations, staged pill, and the returning unread dot

## 1. Location changes happen the moment a pickup is claimed

Today claiming sets the car's location to Unknown, and the real destination is only applied 20 minutes later when the submission leaves the pickup list. That gap is why a technician's car looked like it "left the system" — it sat as Unknown with no destination for 20 minutes.

New behavior, applied immediately on claim:

- Technician / Shop Foreman pickup: location becomes **Bay** (with the tech's name in notes, as today).
- Customer pickup: location becomes **Unknown**.
- Staged submission: location becomes **CP** and the staged flag clears.
- Parts requests: no car location change.

The submission card in the pickup list keeps showing the spot the car was in when it was claimed, so valets can still find it. If someone re-parks the car after the claim, that newer location wins and nothing overwrites it at the 20-minute mark.

## 2. Cars are never removed automatically

Confirming and enforcing: no automatic path deletes a car. The only deletion is the manual "Delete Car" button on a car's screen. Every car stays searchable forever, including cars whose location is Unknown — the lot screen will list Unknown-location cars in a browsable section (not only when searching), so a car with no spot is never invisible.

## 3. "Staged" pill is readable

The checkered "Staged" pill currently draws the checker pattern behind the text, making the word unreadable. It becomes a solid, vibrant pill like the other types (distinct color, bold high-contrast text), so "Staged" reads clearly at a glance.

## 4. Unread dot no longer comes back after pull-to-refresh

Opening a Huri 14-day list clears the dot locally, but the database update silently skips those messages because Huri digests have no sender, so a refresh brings the dot back. The mark-as-read update will be changed to include messages with no sender, so the read state persists across refreshes and devices.

## Technical details

- `src/routes/pickup.tsx`: move the destination logic (BAY / UNKNOWN / CP) from the 20-minute `archiveExpired` sweep into the claim handler right after `claim_pickup_request`; keep the pickup row's `lot_position` snapshot untouched. Archive sweep keeps only the status change plus the existing "moved since claim" guard as a safety net.
- Migration: update `claim_pickup_request()` to set the correct destination instead of `UNKNOWN`, and simplify `archive_stale_pickups()` accordingly so the server-side sweep matches.
- `src/routes/lot.tsx`: always render the Unknown-location group, not only when a search is active.
- `src/routes/pickup.tsx`: replace the `CHECKER` background pill for staged submissions with a solid token-based color.
- `src/routes/thread.$threadId.tsx`: change the read update filter from `neq("sender_id", user.id)` to an `or(sender_id.is.null, sender_id.neq.<id>)` so system/Huri messages are marked read.

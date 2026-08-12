# Pickup List Rules: 20-Minute Archive, Reminders, Claim Limits

## 1. Claimed pickups disappear after 20 minutes (was 60)

- Client-side archive timer and the background cleanup job both switch to 20 minutes.
- Everything else about that moment stays the same: staged cars that weren't re-parked land in CP, technician pickups land in Technician Bay with the tech's name, and a car re-parked before the 20 minutes keeps its newer location.

## 2. Cars are never deleted by the pickup flow

- A car that finishes the pickup list stays in Huri with its RO#, model and notes; only its location becomes Unknown (this is already how claiming works — confirming and keeping it that way).
- Manual deletion from the car screen stays available.

## 3. Pickup history on the car info screen

Add a "Pickup History" section to a car's info screen listing that car's past and current submissions, newest first:

- Type (Pickup / Stage / Park / Parts / Shuttle)
- Submitted by name + date and time
- Claimed by name + date and time (or "Not claimed")
- Any notes attached to that submission

## 4. Second notification for unclaimed submissions after 10 minutes

- A scheduled job runs every minute, finds submissions still unclaimed 10+ minutes after creation that haven't been reminded yet, and sends a follow-up push ("Still unclaimed — 10 minutes") to the same audience the original alert went to (valets, or shuttle drivers / Valet & Parts for those types).
- Each submission gets at most one reminder.

## 5. One claim at a time, 2-minute cooldown

- Claiming is blocked if the person claimed something less than 2 minutes ago; the message explains how long is left.
- Enforced in the database claim function so it holds across devices, and the Claim button is disabled with a countdown in the app while the cooldown is active.

## 6. Blocking text only when a car is actually blocked

- Remove "Not blocked — clear to pull out" from both the pickup cards and the car info screen. Blocking lines only appear when a car really is blocked (or blocking another car).
- "Unnumbered lot — no blocking info" is also dropped since it adds nothing.

## 7. Who can cancel a submission

- Anyone can cancel their own submission.
- Admin, Manager/Service Manager/Assistant Service Manager/Parts Manager, Director/Service Director/General Manager, Shop Foreman, Valet roles, and Advisor can cancel anyone's submission.
- Technicians can cancel only their own; the Cancel button is hidden on other people's submissions.

## Technical notes

- `src/routes/pickup.tsx`: `CLAIM_HIDE_MS` → 20 min; cancel-button visibility gate; remove the no-blocking lines.
- `src/routes/park.tsx`: remove no-blocking text in `BlockingInfo`; new history block reading `pickup_requests` by RO# with submitter/claimer names resolved from `profiles`.
- Migration: add `reminded_at` to `pickup_requests`; change `archive_stale_pickups()` interval to 20 minutes; add the 2-minute cooldown check to `claim_pickup_request()`; schedule the reminder job via `pg_cron` + `pg_net` against a new `src/routes/api/public/hooks/unclaimed-reminder.ts` route (anon `apikey` header auth, same pattern as the stale-cars hook).
- `src/lib/roles.ts`: add a `canCancelAnyRole()` helper for the cancel permission list.

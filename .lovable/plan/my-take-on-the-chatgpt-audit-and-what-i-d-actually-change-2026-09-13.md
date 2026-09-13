# My take on the ChatGPT audit — and what I'd actually change

The list is thorough and mostly well-aimed, but it's written for an app that has many dealerships and many attackers. Huri today has exactly one dealership (Ontario JCD) and a closed set of employees, so a lot of it is preparing for a future that hasn't happened. I checked the real code and database before writing this, so the items below are confirmed, not guesses.

Doing all 30-plus phases at once would rewrite most of Huri and risk breaking workflows your team relies on daily. I'd rather fix the things that are genuinely wrong now, in three passes.

## What it got right (confirmed in your project)

1. **New records are hard-wired to the first dealership.** Cars, requests, messages, photos, wash records and events all default to the original dealership ID. The rule that's supposed to look up the person's own dealership can never take effect, because the default fills the field first. Harmless with one dealership, silently wrong the day you add a second.
2. **Repair-order numbers are unique across the whole system, not per dealership.** A second dealership could not use an RO number the first one already had. There's also a correct per-dealership rule sitting right next to the old global one, plus a duplicate spot rule — leftovers worth cleaning up.
3. **Message notifications trust who the sender says to notify.** The one place a person could, in theory, push a notification to someone outside their own dealership.
4. **Employee photos are served with no sign-in required** and cached as public. Anyone with a photo link can view it, and a photo address pointing offsite is followed blindly.
5. **Sign-up is open and unthrottled.** Anyone who reaches the page can create unlimited pending accounts and flood your approval queue with notifications. Privileged roles are already blocked, so this is nuisance, not a break-in.
6. **Some database saves ignore failures.** A handful of places treat "didn't work" as "worked," so a person sees success when nothing saved.

## What I'd ignore or defer, and why

- **Rewriting sign-up to invitation-only, ownership transfer as a single transaction, photo folders re-organised per dealership, a formal vehicle state machine.** These are correct for a multi-dealership product. Today they're churn with real regression risk. The photo-file move in particular means touching every existing picture — I don't want to do that for a risk that can't be reached yet.
- **"Trust nothing the app sends."** Mostly already true: writes go through rules tied to the signed-in account, and privileged actions re-check the account on the server. The genuine exception is the notification one above.
- **Blanket login rate limiting.** Sign-in goes straight to the auth service, which already throttles it. Adding our own layer invites an attacker locking out your staff — which the document itself warns against.
- **Aggressive validation of every field for Unicode, huge strings, and so on.** Worth spot-checking, not worth a sweep; the database already caps and normalises the fields that matter.

## Pass 1 — correctness and safety (I'd do this now)

- Remove the hard-wired dealership defaults on cars, requests, messages, photos, wash records and events so each record follows the person who created it, and refuse the save when it can't be determined.
- Drop the old global repair-order rule and the duplicate spot rule, keeping the per-dealership ones.
- Notifications for a message are worked out on the server from the message itself, not from a list the app supplies.
- Require sign-in for employee photos, cache them privately, and stop following offsite photo addresses.
- Add simple throttling to account creation and to the approval notification it triggers.

## Pass 2 — no more silent failures, no more blank screens

- Every save, delete and status change reports failure clearly, keeps what was on screen, and offers a retry. No more "success" when nothing happened.
- A safety net around the app and each page, so one broken piece shows a "something went wrong, tap to retry" card instead of a white screen; the technical detail is logged, never shown.
- Buttons that submit stay disabled while working, so a double-tap on a phone can't create two pickups or two cars.

## Pass 3 — concurrency and cleanup

- Confirm the two-people-at-once cases behave: same pickup claimed twice, same spot assigned twice, one person's stale screen overwriting a newer change. Spot assignment and claiming already lock the row; I'd verify rather than rebuild.
- Check live-update subscriptions are cleaned up when leaving a page, and that timers and listeners don't pile up.
- Fix the four standing database warnings, including the leaked-password setting you asked me to turn off earlier — I'd leave that off unless you want it back.

## Technical notes

- Confirmed by query: `parked_cars_ro_unique` (global, on `ro_number`) still exists alongside `parked_cars_one_active_ro_per_dealership`, and `parked_cars_unique_sv_spot` duplicates `parked_cars_one_car_per_numbered_spot`.
- Confirmed hard-coded `DEFAULT '00000000-...0001'` on `parked_cars`, `pickup_requests`, `messages`, `car_events`, `car_washes`, `car_photos`; `set_dealership_from_user()` only fires when the value is NULL, so it never applies.
- `sendMessagePush` accepts `recipientId` / `recipientRoleId` from the client and reads subscriptions with the admin client; the fix is to pass a `messageId`, load the row, verify sender and dealership, then derive recipients.
- `/api/public/avatar/$id` has no auth, sets `Cache-Control: public, immutable`, and 302-redirects to any non-data `avatar_url`.
- All changes are new corrective migrations; deployed migrations stay untouched.
- Verification per pass: typecheck, production build, database linter, and a live click-through of pickup, park, wash, photos, inbox and reports.

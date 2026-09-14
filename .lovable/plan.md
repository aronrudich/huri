# Stay on Flagged Cars, silence the pickup shortcut, and fix reset emails

## 1. Stay on the 14-day list

Today, tapping "Car Has Been Picked Up" on a car opened from Flagged Cars sends you to the pickup list, so you have to walk back in from the home page each time.

Change: the car page remembers where you came from. When you open a car from Flagged Cars and mark it picked up (or delete/save it), you go straight back to the Flagged Cars list, with the car already gone from it. Opening the same car from the lot list keeps today's behavior.

## 2. No notification for "Car Has Been Picked Up"

Marking a car picked up currently pops a "New pickup request" alert on valets' phones, because it records a hidden pickup row and the valet list alerts on every new row. Change: the alert only fires for real waiting requests, so the shortcut is silent.

## 3. Password reset emails

Confirmed: this project has no sender domain set up, so reset emails go out through Lovable's shared default sender — that is the likely reason they land in spam or never arrive, and it can also hit an hourly send cap.

Plan:
- Check the recent auth email attempts and the hourly limit, and raise the limit if that is what blocked it.
- Recommended fix: set up a sender domain you own (e.g. mail.yourdomain.com) so reset emails come from Huri's own address and reliably reach inboxes. That takes a domain you own plus one DNS step, and I can start it when you say go.
- Meanwhile I'll confirm whether the reset link itself works by triggering a reset for a test address and watching the send result.

## Technical notes

- `src/routes/park.tsx`: add an optional `from` search param (`flagged`); after the picked-up shortcut, delete, and save, navigate back to `/flagged` when `from === "flagged"`, otherwise keep current targets. `src/routes/flagged.tsx` row click passes `search: { id: car.id, from: "flagged" }`.
- `src/routes/pickup.tsx` valet INSERT alert (line ~162): ignore rows whose `status` is not `unclaimed` or `claimed`, which excludes `picked_up` shortcut rows.
- Email: inspect auth email send state and `rate_limit_email_sent`; recommend `email_domain` setup for deliverability. No template scaffolding until a domain exists.

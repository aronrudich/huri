# Customer arrival: smooth wheels, day picker, live 20-minute queue, faster refresh

This turns the customer arrival page from preview-only into live.

## 1. Smooth time wheels (customer page)
- Remove the smooth-scroll setting that fights the finger's natural momentum.
- Never move the wheel while a finger is dragging or the wheel is still gliding. Only save the number once the wheel has fully stopped.
- Tapping the number just above or below the middle line slides it into place.

## 2. Pick a day
- Above the wheels: **Today** (default), **Tomorrow**, **Pick a date** (any future day, using the existing calendar).
- The confirmation reads "Arriving Today at 4:00 PM", "Arriving Tomorrow at 4:00 PM", or "Arriving Thursday, Oct 1 at 4:00 PM".
- If the customer opens the link again, the day and time they picked are already filled in.

## 3. Going live on the pickup list
- When a customer submits, the car goes on the pickup list right away, however far away the time is. If they update the time, the same card changes. No second card is made.
- **More than 20 minutes away:** the card sits at the bottom under "Upcoming Arrivals". It looks lighter and less bold, and the Claim button is locked with "Activates in 2h 15m". Valets can still see the stall and which cars are blocking it.
- **20 minutes before the ETA** (for example, 3:40 PM for a 4:00 PM arrival): the card becomes normal, turns teal blue, moves to the top as the highest priority, and can be claimed. This switch happens on its own without a refresh.
- **Notifications:** valets and Admins get a ding only when the card becomes active at the 20-minute mark, not when the customer first submits. A customer who submits less than 20 minutes out causes an immediate ding.
- When a future-day arrival is still upcoming, its card says "Tomorrow" or shows the date.

## 4. Faster pull-to-refresh
- The spinner closes after about 0.8 seconds. Data refreshes quietly in the background.
- Remove the extra full-page reload that kept the spinner stuck.

## Technical details
- `arrive.$slug.tsx`: remove `scroll-smooth`. Track touch and `scrollend` (with a settle fallback). Skip programmatic `scrollTop` while the user is interacting. Add a day selector that reuses `DateRangeCalendar` in single-day mode or a small variant.
- `resolveEta(tz, date, h, m, meridiem)`: takes a `YYYY-MM-DD` date. `submitArrival` validates that the date is today or later and upserts a `pickup_requests` row (kind pickup, source_role Customer, status unclaimed, `customer_eta`), reusing an open row with the same RO. `getArrivalInfo` also returns the date.
- Activation time is `customer_eta - 20 min`, computed on the client using the existing `nowTick`. Inactive cards sort last and hide Claim. The server claim path rejects early claims.
- Ding at activation: add a nullable `eta_notified_at` column. The existing per-minute reminder cron route sends `notifyValetsOfArrival` for rows that have become active but have not been notified. A submission already inside 20 minutes notifies right away and stamps the column.
- Add a semantic `--arrival` (teal) token in `styles.css`. Do not hardcode teal classes.
- The 30-minute auto-archive timer counts from the claim, as it does today, so upcoming cards never expire before they activate.
- `PullToRefresh.tsx`: fire-and-forget invalidation, fixed 800ms dismiss, drop `router.invalidate()`.

# Open to the pickup list, unread badge, wash marks, and the cancel fix

## 1. Cancel is broken (confirmed cause)

The database only allows the statuses `unclaimed`, `claimed`, and `completed`. When Cancel was changed to write `canceled` (so canceled work stays out of Reports), every cancel now fails with the check-constraint error in your screenshot. Fix: allow `canceled` in the database so Cancel saves again and stays excluded from stats.

## 2. App opens to the pickup list

The pickup list becomes the app's home screen. Messages move to their own tab address, and everything that used to go "home" (Huri logo, back arrows, sign-in) lands on the pickup list. The installed app icon and shortcut also open the pickup list.

## 3. Red dot on the message tab

When any thread is unread, a bright red dot appears inside the inbox icon in the bottom bar (small, offset over the icon corner, does not hide it). It clears as soon as everything is read.

## 4. Notifications open the right screen

Tapping a push notification opens the screen that notification is about: a message notification opens that conversation, a pickup/parts/park/wash/stage alert opens the pickup list, the 9 AM 14-day digest opens its Huri message. This already partly works but the tap handler only matches an existing window loosely — it will be changed to always navigate the reopened window to the notification's target.

## 5. Washed cars show the green check in the pickup list

Pickup submissions whose RO# has a recorded wash get the same green wash check next to the RO number, so everyone sees a car is washed without opening it.

## Technical details

- Migration: `pickup_requests_status_check` dropped and recreated with `'canceled'` added. `car_events_from_pickups` already handles the canceled branch.
- Routing: move current `src/routes/index.tsx` inbox screen to `src/routes/inbox.tsx`; new `src/routes/index.tsx` renders the pickup list (move the pickup screen body into a shared component imported by both `/` and `/pickup`, keeping `/pickup` valid for existing notification URLs). Update `HuriLogo`, `BottomBar` inbox link, and the back links in `thread.$threadId.tsx`, `profile.tsx`, `parts.tsx`, `compose.tsx`, plus `auth.tsx` redirects. `public/manifest.webmanifest` `start_url` -> `/pickup`.
- Unread badge: add a lightweight unread-count derivation (reuse `messagesQuery` + `read_at` logic already in the inbox) in a small hook so `BottomBar` can render a `bg-destructive` dot on the inbox icon.
- `public/sw.js` `notificationclick`: focus an existing client and call `client.navigate(url)` (fall back to `openWindow`).
- Wash marks: new `carWashesQuery` (RO# set from `car_washes`) in `src/lib/queries.ts`; `pickup.tsx` renders the existing green check style next to RO# when the RO is in that set.

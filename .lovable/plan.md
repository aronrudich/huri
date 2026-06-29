## Problem

Two related bugs in the notification flow:

1. **Switch on Profile won't toggle** — `Switch.onCheckedChange` calls `toggleNotifs` → `subscribePush`, which does network/DB work *before* the browser permission state is reflected in React. If the browser silently suppresses the prompt (Chrome's "quieter messaging" UI on desktop), `Notification.requestPermission()` resolves to `"default"`, `subscribePush` returns `"denied"`, and the switch never flips. The user sees nothing happen.

2. **Gate modal "Allow Notifications" can falsely give up** — `enable()` wraps `subscribePush` in `Promise.race` with an 8-second timeout. If the user takes longer than 8s to click Allow in the browser prompt, the race resolves as `"unsupported"`, the modal closes, and no subscription is created.

3. **In-app `notify()` is silently a no-op when the tab is focused** — Chrome doesn't display `new Notification()` banners when the tab is focused; only the SW `showNotification` path does. That's why desktop "notifications don't work" even when permission is granted and the user is testing in the same tab.

## Fix

### `src/lib/push.ts`
- Split `subscribePush` into two steps:
  - `requestNotifPermission()` — synchronous-ish call that ONLY does `Notification.requestPermission()` and returns the result. Called directly from the click handler so the gesture isn't lost.
  - `registerPushSubscription(userId)` — does the SW registration + DB upsert. Called after permission is granted.
- Update `notify()` to prefer the active service-worker registration's `showNotification()` (works whether tab is focused or not) and fall back to `new Notification()`.

### `src/routes/profile.tsx` (`toggleNotifs`)
- On enable, first call `requestNotifPermission()` directly. Update `perm` state immediately based on the result. If granted, then await `registerPushSubscription` (DB write can happen after the switch flips). If not granted, show a clear toast and keep the switch off.
- Add an optimistic `setNotifOn(true)` so the switch flips visually the instant permission is granted.

### `src/components/NotificationGate.tsx` (`enable`)
- Remove the 8-second `Promise.race` timeout. Call `requestNotifPermission()` directly, then kick off `registerPushSubscription` in the background. Close the gate on `granted` regardless of subscription completion.
- Add a "Test notification" debug helper visible only while perm === "granted" but no recent activity — optional, helps the user verify end-to-end during the demo.

### Add a small "Send test notification" button on Profile
- Below the switch, when notifications are on, show a "Send test" button. It posts to a new server function `sendTestPush(userId)` that calls `sendWebPush` against the user's own subscriptions. Confirms the full SW → OS-banner path works on the current device. Critical for the demo since in-tab `new Notification()` never shows on desktop Chrome when the tab is focused.

### `src/lib/push.functions.ts`
- Add `sendTestPush` server function (requires auth, sends a "Huri test notification" web push to all of the calling user's `push_subscriptions` rows).

## What stays the same
- VAPID keys, `public/sw.js`, message/pickup push payloads, and the existing `sendMessagePush` / pickup notification flow are unchanged.

## Verification
- On desktop Chrome at `huri.lovable.app/profile`: toggle flips immediately on permission grant; "Send test" produces an OS-level banner with sound even with the tab focused.
- Toggling off pauses future pushes (already wired via `notif_pref`).

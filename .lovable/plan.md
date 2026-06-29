## Goal
Make Huri's push notifications work on desktop (Mac/Windows) the same way they work on mobile — so anyone signed in on a laptop gets an OS-level notification (with sound) when a pickup is requested or a message arrives, even when the Huri tab is in the background.

## Why this isn't working today
Two things in the code currently block desktop:

1. **`NotificationGate.tsx`** only shows the "Allow Notifications" prompt on touch devices (`matchMedia("(hover: none) and (pointer: coarse)")`). Desktop users never see the prompt, so they never grant permission and never get a push subscription created.
2. **`subscribePush()` in `src/lib/push.ts`** works fine on desktop browsers — the gate is the only thing keeping desktop users out.

Everything else (service worker, VAPID keys, `sendPickupAlert`, `sendMessagePush`) is already browser-agnostic and will fire to any subscribed endpoint, desktop included.

## Changes

### 1. `src/components/NotificationGate.tsx`
- Remove the touch-only check. Show the gate on any browser that supports `Notification` + `serviceWorker` + `PushManager` (Chrome, Edge, Firefox, Brave on Mac/Windows/Linux; Safari only when installed to Dock).
- Tweak the copy so it reads naturally on desktop too: "Huri will alert you the moment a pickup request comes in or a teammate messages you — even when this tab is in the background."
- Keep the "Not now" dismiss behavior unchanged.

### 2. `src/components/IOSInstallHint.tsx` (light touch)
- Leave the iOS hint alone — it's already correctly scoped to iOS Safari.

### 3. Profile page (`src/routes/profile.tsx`) — small addition
- Under the existing notifications toggle, add a one-line status row showing whether push is currently subscribed on **this device** ("Notifications active on this device" / "Not enabled on this device — tap to enable"). Tapping re-runs `subscribePush()`. This lets a user who dismissed the gate on desktop turn notifications on later without clearing site data.

### 4. No backend changes
`push_subscriptions` already stores one row per endpoint, so the same user signed in on phone + laptop gets two rows and both receive every notification. `sendPickupAlert` and `sendMessagePush` already fan out to all rows for the recipient.

## What desktop users will see after this ships
- First login on a laptop → "Allow Notifications" modal → browser permission prompt → granted.
- A pickup is created → native macOS/Windows notification banner appears with sound, even if Huri is in another tab or minimized (browser must be running).
- A message arrives → same banner, with sender name and preview.
- Clicking the banner focuses/opens the Huri tab on the right page.

## Browser support notes (for your awareness, not code)
- Chrome, Edge, Firefox, Brave, Opera on Mac/Windows/Linux: full support, works in background.
- Safari on macOS: only supports web push when the site is added to the Dock (Safari → File → Add to Dock). Without that, Safari desktop users will get the in-app toast but no OS banner. We can add a "Safari users: add Huri to your Dock" hint later if needed — flag if you want that now.

## Out of scope
- Email fallback (you picked browser push only).
- Native desktop app / Electron wrapper.
- Changing who receives what — every user already gets the notifications relevant to their role.

# Pickup notifications for Admin + retire the "Valet & Parts" role

## What I checked

- Every pickup-list fan-out (new pickup, park, wash, stage, parts, unclaimed 5-minute reminder) already includes `Admin`, so the audience lists are correct.
- Your account does have 5 saved push devices, and advisors submitted pickups today, so those alerts were attempted.
- The likely cause: saved devices go stale and are never re-checked. A device subscription is only written when you tap "Allow" or flip the Profile switch — never on later app opens. Your iOS entry dates from mid-July; if the PWA was reinstalled or the browser rotated the subscription, pushes now go to a dead address and silently vanish. There is also no way today to see whether a push actually landed.
- Separate issue found: the Profile notification switch is stored only on the device (localStorage). Turning it off does not stop the server from sending, and turning it on doesn't necessarily re-register a fresh device.

## What I'll do

### 1. Self-healing push registration
- On every app open (for signed-in users with permission granted), silently re-check the browser's current push subscription and upsert it, so a rotated/reinstalled device immediately becomes reachable again.
- Prune the old row when the browser reports a different endpoint for the same device, so dead entries stop accumulating.

### 2. Make the Profile switch real
- Store the on/off state on the user's account instead of only the device, and skip that user server-side when it's off. Off = no notifications until they flip it back on; on = re-register the device right away.
- Keep the current blue/grey switch look.

### 3. Visible proof it works
- Keep the "Send test notification" button, and have it report exactly how many of your devices accepted the push and how many dead ones were removed — so before a demo you can confirm in one tap.

### 4. Remove "Valet & Parts"
- Drop it from the role list everywhere (sign-up, role-change request, manager role switcher).
- Move the one employee currently on that role (Jesus Leos) to `Valet`.
- Parts submissions now notify the same audience as everything else in the pickup list: all valets plus Admin (and the shuttle-capable valets), instead of the old parts-only audience. Parts requests stay visible and claimable by everyone, as they are now.
- Clean up the leftover role-expansion special cases (group messaging, unclaimed reminders, valet role helpers) so `Valet` is the single valet role.

## Technical notes

- `src/lib/push.ts`: add `syncPushSubscription(userId)` that re-reads `pushManager.getSubscription()`, subscribes if absent, upserts on `endpoint`, and deletes rows for this user whose endpoint no longer matches the active one; call it from the app shell on mount/visibility-regain.
- Migration: add `profiles.notifications_enabled boolean not null default true`; update the profile-update RLS check so a user may change it for themselves; set role `Valet & Parts` → `Valet` for existing rows.
- `src/lib/push.functions.ts`: filter every recipient query with `.eq("notifications_enabled", true)`; replace `["Valet","Valet & Parts","Valet & Shuttle","Admin"]` with `["Valet","Valet & Shuttle","Admin"]`; `sendPartsAlert` uses the same list as `sendPickupAlert`; `membersForRole` no longer expands Valet.
- `src/routes/api/public/hooks/unclaimed-reminder.ts`: same audience change; parts uses the shared valet+Admin list.
- `src/lib/roles.ts`: `VALET_ROLES = ["Valet","Valet & Shuttle"]`, remove `Valet & Parts` from `ROLE_OPTIONS`.
- `src/routes/index.tsx`: drop the Valet & Parts role-id merge.
- `src/routes/profile.tsx`: switch reads/writes the profile column; test-push toast shows sent/pruned counts.

# Suspend the Service Manager role

Goal: the Service Manager role keeps its account and can still sign in and look around, but has zero powers and gets zero notifications. No accounts are deleted.

## What changes for the user

- Service Manager loses all admin powers: no approving/denying new accounts, no approving/denying role change requests, no removing employees, no changing anyone's role.
- Service Manager no longer appears in the roster/management group, loses the ability to cancel other people's submissions, and loses staging rights.
- Service Manager receives no push notifications and no Huri inbox alerts: no pickup/parts/shuttle alerts, no unclaimed reminders, no 14-day parked-car alerts, no "waiting for approval" alerts.
- In the app, a Service Manager sees a clear "Account suspended — read-only" banner, and every action button (submit pickup/park/parts/shuttle, claim, cancel, delete, edit profile, send message) is disabled. They can still view screens. NO this is not true. The service manager shouldn't know that their suspended. So there should not be any type of banned or anything like that. They can't know.
- Their account, profile, history, and messages stay intact. Restoring them later is a one-line change plus switching their role back.

## Approvals after this change

Only the owner account ([aron@oremor.net](mailto:aron@oremor.net)) and the Admin role handle new-account approvals and role change requests. Since the 14-day parked-car alert currently goes only to the Service Manager, it will be redirected to the Admin role so it does not silently stop.

## Technical notes

- `src/lib/roles.ts`: add `SUSPENDED_ROLES = ["Service Manager"]` plus an `isSuspendedRole()` helper. Remove "Service Manager" from `APPROVER_ROLES`, `MANAGEMENT_ROLES`, `CANCEL_ANY_ROLES`, and make `canStageRole` return false for suspended roles (its `/manager|director/i` regex currently matches it). Keep it in `ROLE_OPTIONS` so existing profiles still render.
- Notification audiences: drop the role from `src/lib/push.functions.ts` recipient lists, `src/routes/api/public/hooks/unclaimed-reminder.ts` (`audienceFor`), and switch `ALERT_ROLES` in `src/routes/api/public/hooks/stale-cars.ts` to `["Admin"]`.
- Server-side enforcement (not just UI): add a `assertNotSuspended` check in `src/lib/admin.functions.ts` (`callerContext` returns `isAdmin: false` for suspended roles) and a suspension guard at the top of the handlers that create pickups/park cars/send messages so a suspended account cannot act even via a crafted request.
- Client gate: expose `isSuspended` from `src/lib/auth-context.tsx`, render a suspended banner in `src/routes/__root.tsx` (same slot as `PendingGate`), and disable action affordances in `BottomBar`, `pickup`, `park`, `pickup-new`, `parts`, `shuttle`, `bring-me`, `park-request`, `compose`, `thread.$threadId`, `profile`.
- Database: keep the row intact; no account deletion, no `is_active` flip (that would break their read access via `parked_cars_readable_by_tenant`-style policies). Writes are blocked by the server-function guards above.

## Code download

After the changes are in, package the current source (excluding `node_modules`, `.git`, build output) as a zip in this chat for download.
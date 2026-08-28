# Fix user deletion, un-suspend Service Manager, wash emoji

## 1. "Database error deleting user"

Confirmed cause: two tables still point at the user account without a cleanup rule — car history events (`car_events.actor_id`) and wash records (`car_washes.washed_by`). Every other table already clears or cascades on delete, so a removal only fails once the employee has touched a car or washed one — which is why Jason Stokes can't be removed.

Fix: a migration changing those two references to clear the actor instead of blocking (set to empty). Car history and wash records stay in the system permanently; they just no longer name the deleted employee. Removing employees then works from the roster.

## 2. Service Manager back to normal

Undo the silent suspension completely:

- Remove the suspended-role list and its helper from `src/lib/roles.ts`, and put "Service Manager" back into the approver, management/roster, and cancel-anyone lists; staging rights return via the manager/director rule.
- Drop the suspension guards and `isSuspended` handling from `src/lib/admin.functions.ts` (approvals, role requests, delete-own-account, signup notifications).
- Delete `src/lib/suspension.ts` and `src/lib/suspension.server.ts` and remove their imports/`useSuspended()` no-op branches from the action screens (`pickup`, `pickup-new`, `park`, `park-request`, `parts`, `shuttle`, `wash`, `compose`, `thread.$threadId`, `EditProfileSheet`) and from `src/lib/push.functions.ts`.
- Notifications: Service Manager is back in the pickup/parts/unclaimed audiences, and the 9 AM 14-day car list goes to Service Manager and Admin.

So the Service Manager can again approve new accounts and role changes, appears in the roster and management group, can stage and cancel anyone's submission, and receives notifications normally.

## 3. Wash pill emoji

Add 🧼 to the "Wash" pill label in the pickup list (`src/routes/pickup.tsx`) so it reads 🧼 Wash.

# Quick self role switching + full app health sweep

## 1. Switch your own role instantly (no request)

Confirmed current behavior in the profile screen:

- The roster list explicitly filters out your own account, so searching your own name shows "No matches" (matches your screenshot).
- The role-change and remove buttons are hidden for the owner account, so even if you appeared in the list there'd be no switch button for you.

Changes:

- Show your own account in the roster search results for admin-equivalent roles (Admin, Service Manager, Service Director) and the owner.
- Give your own row the same "Change role" switch button, so you pick a new role and it applies immediately — no approval request, no pending state.
- Keep the remove/delete button hidden on your own row and on the owner's row (nobody can delete themselves or the owner by accident).
- After switching, the app just refreshes your profile silently: no message, no notification to anyone, and any leftover pending role request is cleared.
- Other employees' rows behave exactly as today. Non-admin employees keep using "Request role change".

Server side: role changes go through the existing admin role-setter, which already verifies the caller is an admin-equivalent role in the same dealership. Self-targeting is allowed for those roles only; ordinary employees still cannot change their own role.

## 2. Make sure nothing is broken for anyone

The error you saw this morning came from a database routine that lost the privileges it needed after a change. To prevent a repeat, this pass verifies the whole app end to end rather than just the one screen:

- Walk every page while signed in and confirm it loads and its buttons work: inbox, thread view, compose, pickup list, new pickup, park, park request, add-to-Huri, parts, wash, bring me, lot list, reports, profile.
- Exercise the write paths that touch the database routines: add a car, move a car to a taken spot (displacement prompt), submit each request type, claim, cancel, send a message, mark read, toggle notifications.
- Run the database linter and check the app's runtime error/console logs for anything failing quietly.
- Confirm the privileged database routines all still have correct ownership and search paths, so the "permission denied" class of error can't come back.
- Anything broken found in this sweep gets fixed in the same pass.

No visible change for employees other than the roster showing your own row, and nothing that requires action from any user.

## Technical notes

- `src/routes/profile.tsx`: drop the self-exclusion in `filtered` for admin/owner callers, adjust the roster count, and allow the change-role button on the self row while keeping delete gated.
- `src/components/ChangeRoleSheet.tsx`: on save for the current user, refresh the auth-context profile so the header role updates instantly.
- `src/lib/admin.functions.ts` (`setEmployeeRole`): keep the admin assertion, clear `pending_role_name`, and send no notification.
- Verification via a headless browser pass against the running app plus the database linter; fixes as needed.

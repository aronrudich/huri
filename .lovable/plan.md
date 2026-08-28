# Restore Service Manager and Service Director as admin-equivalent roles

## Goal
Make **Service Manager** and **Service Director** work like **Admin** throughout Huri, with one intentional exception: neither role receives pickup-list notifications.

## Changes

1. **Unify privileged role checks**
   - Define Admin, Service Manager, and Service Director as the shared administrative/approver group.
   - Use that shared role check for account approvals, role-change approvals, direct employee role changes, employee deletion, roster access, staging, and cancel-anyone behavior.
   - Keep the owner override and same-dealership protections unchanged.

2. **Restore the complete management UI**
   - Ensure both roles see the approvals queue and employee roster.
   - Ensure both roles can open the role editor, change another employee’s role immediately, and remove eligible employees.
   - Preserve the rule preventing non-owners from deleting the owner.

3. **Exclude both roles from pickup-list notifications only**
   - Remove Service Manager from the current pickup, parts, shuttle, and unclaimed-reminder push audiences.
   - Do not add Service Director to those audiences.
   - Keep Admin in those pickup-related audiences.
   - Continue allowing Service Manager and Service Director to receive ordinary direct/group message notifications, account/role approval notifications, and the non-pickup 14-day car digest, matching Admin behavior.

4. **Remove any remaining suspension mismatch**
   - Verify there are no lingering client, server, or database suspension checks that block either restored role.
   - Keep normal active/approved-account checks in place.

5. **Validate end to end**
   - Test the role matrix for Admin, Service Manager, Service Director, and a non-admin employee.
   - Confirm both restored roles can approve accounts and role requests, change roles, and delete employees.
   - Confirm pickup and unclaimed-reminder recipient lists omit both restored roles while Admin remains included.

## Technical details
- Centralize the admin-equivalent role list in the role capability module so client visibility and server authorization cannot drift apart.
- Update the touched server-function modules to keep runtime helpers outside the server-function wrapper files, preserving TanStack Start’s server/client split requirements.
- This change does not alter user accounts or assign anyone a new role; it changes what the two role names are allowed to do.

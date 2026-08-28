# Fully restore Service Manager database access

## Confirmed cause
The Service Manager account is active and approved, but the deployed database still contains the previous suspension rules:

- `private.is_active_employee(...)` explicitly excludes `Service Manager`.
- The pickup insert policy requires that function to return true, causing the exact row-level-security error shown in the screenshot.
- The old `private.is_suspended(...)` check also still prevents Service Managers from sending messages.

The frontend and administrative server checks already treat Service Manager and Service Director as Admin-equivalent roles; the remaining failure is in the database authorization layer.

## Changes
1. Add a database migration that restores `private.is_active_employee(...)` for every active employee, including Service Manager.
2. Remove the obsolete Service Manager suspension condition from the message insert policy and remove the old suspension helper once nothing references it.
3. Preserve tenant isolation, approved-account checks, active-account checks, and all existing write policies.
4. Keep Service Manager and Service Director excluded from pickup-list push notifications, as requested; this fix restores app actions, not those notification audiences.

## Validation
- Confirm the Service Manager account passes the active-employee database check.
- Confirm pickup creation is allowed by the pickup policy for that role.
- Confirm messaging, car updates, wash updates, and other employee actions no longer inherit the old suspension.
- Run the database linter and verify the app still loads.

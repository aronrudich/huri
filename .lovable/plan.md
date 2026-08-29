# Make every pickup-list notification reliable

## Confirmed findings

- Pickup, Park, and Wash currently insert the submission from the browser, start the notification call without waiting for it, and immediately navigate away. That notification request can be canceled even though the pickup itself was saved, which explains why recipients receive only some alerts.
- Pickup alerts reuse one notification tag per type (`pickup`, `park`, `wash`, or `stage`). Browsers may replace an earlier visible alert with the next alert carrying the same tag.
- The intended audience query already includes active Valets, Valet & Shuttle employees, and Admins whose notification setting is enabled.
- Recent pickup submissions are reaching the database, and the active Admin/Valet accounts have saved push subscriptions; this is therefore a delivery-path issue rather than missing pickup data.

## Implementation

### 1. Make pickup creation and notification one reliable operation
- Add one authenticated server operation that creates a Pickup, Park, Wash, Stage, or Parts request and then awaits its push fan-out before returning success.
- Update every submission form to await that operation before showing success or navigating away.
- Remove the current split pattern where the browser inserts first and launches a fire-and-forget notification request afterward.
- Keep all existing validation, pickup fields, role permissions, queue behavior, and car updates unchanged.

### 2. Prevent alerts from replacing one another
- Give every notification a unique tag based on the newly created pickup request ID rather than reusing a tag for the entire request type.
- Preserve the current titles, colors/types, destination link, urgency, vibration, and sound behavior.

### 3. Centralize and harden recipient delivery
- Use one shared pickup audience rule for every pickup-list submission: active, approved `Valet`, `Valet & Shuttle`, and `Admin` users at the same dealership with notifications enabled.
- Continue removing subscriptions that return permanent `404` or `410` failures.
- Record and surface non-permanent provider failures instead of silently swallowing them, and retry transient delivery failures once within the request.
- Return counts for intended recipients, saved devices, accepted sends, stale devices removed, and failures so a successful form submission cannot falsely imply that notification fan-out was never attempted.

### 4. Verify the complete matrix
- Test Pickup, Stage, Park, Wash, and Parts submissions through their real forms.
- Confirm each creates exactly one queue item and attempts delivery to every eligible Admin/Valet device.
- Confirm back-to-back submissions produce separate notifications rather than replacing one another.
- Confirm disabled notifications, inactive/unapproved users, and stale subscriptions remain excluded or cleaned up as intended.

## Technical notes

- Keep server-function declaration files as thin wrappers; place shared insertion, audience resolution, retry, and delivery logic in a server-only helper.
- Use the authenticated backend client for the insert so existing row-level dealership and employee protections still apply.
- Do not change message notifications, daily reports, pickup claiming, or queue display behavior as part of this fix.

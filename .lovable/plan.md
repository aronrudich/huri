# Stage submissions use the pickup form

## What changes

1. **Stage button opens the pickup form.** The Stage button in the header (advisors, managers, directors) now opens the same form used for customer pickups, in "stage" mode. Same fields: RO number, submitted-by, car model, notes. Heading and submit button read "Stage Car" / "Submit Stage" so it's clear what's being sent.

2. **The separate Stage page goes away.** The old searchable stage/un-stage list is removed; staging happens by submitting the form, exactly like a pickup.

3. **Staged submissions in the pickup list get a checkered look.** The list now has four visual types:
   - Blue: customer/advisor pickup
   - Red: technician pickup
   - Yellow: parts request
   - Checkered (black and white): staged
   The staged card gets a checkered top bar labelled "Staged" and a checkered-toned border, matching the checkered pattern already used on the lot map for staged spots. Its Claim button stays a normal, tappable button.

4. **No valet notifications for staged submissions.** Staged submissions send no push and trigger no in-app alert; they only appear in the list. (Already the behaviour for staged pickups; it stays.)

5. **Staged always sorts last among unclaimed.** Any unclaimed customer, technician, or parts request appears above every unclaimed staged submission, regardless of which was submitted first. Within each group, oldest first. Claimed items keep their existing position at the bottom and still disappear 60 minutes after being claimed.

## Technical notes

- `src/routes/pickup-new.tsx` accepts a `staged` search param. When set, the insert writes `is_staged: true`, skips `sendPickupAlert`, and also flags the matching `parked_cars` row as staged so the map spot shows the checkered pattern. Non-staged submissions keep today's behaviour (including clearing a car's staged flag).
- `src/components/BottomBar.tsx`: Stage button links to `/pickup-new` with `search={{ staged: true }}` instead of `/stage`.
- `src/routes/stage.tsx` deleted.
- `src/routes/pickup.tsx`: add a staged branch to the `ringClass` / `headerBar` / `headerLabel` and Claim-button styling, using the same `repeating-conic-gradient` checker as `LotMap`. Sorting logic is already staged-last; it stays and is verified.
- No database changes: `is_staged` already exists on `pickup_requests` and `parked_cars`.

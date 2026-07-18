## 1. Role sheet cut off on mobile
`src/components/ChangeRoleSheet.tsx` — the sheet's inner container has no height cap, so the Save button gets pushed below the viewport on short mobile screens.

- Wrap the sheet in a flex column with `max-h-[90vh]`.
- Make the roles list the flex-1 scroll region (keep `overflow-y-auto`, drop the fixed `max-h-72`).
- Keep the header and Save button as fixed-height sections at top/bottom so Save is always visible.
- No visual changes on desktop.

## 2. Desktop delete for a conversation
`src/routes/thread.$threadId.tsx` — add a trash icon button in the top-right of the thread header (desktop-only via `hidden sm:inline-flex`, so mobile swipe stays untouched).

- On click: confirm, call `hideThreadForUser(user.id, threadId, new Date().toISOString())`, then navigate back to `/`.
- Reuses the existing `thread_hides` mechanism, so it syncs the hide across devices exactly like the mobile swipe.

## 3. RO# must be exactly 6 digits
Add a shared validator (regex `/^\d{6}$/`) and enforce it before submit in:

- `src/routes/park.tsx` — block submit with `toast.error("Invalid RO#")` when the RO is not 6 digits.
- `src/routes/pickup-new.tsx` — same validation on the pickup form's RO field.

Also add `inputMode="numeric"` and `maxLength={6}` on those inputs so the mobile keypad is numeric. No DB constraint change.

## 4. Parts submissions visible to everyone in the pickup list
`src/routes/pickup.tsx` — the visibility filter currently hides `kind === "parts"` from anyone who isn't Valet & Parts or Technician.

- Remove that filter so parts requests appear in the pickup list for every role.
- Leave the push-notification logic alone: `sendPartsAlert` in `src/lib/push.functions.ts` already targets only Valet & Parts, and the in-app toast in `pickup.tsx` line 95 already gates the sound/toast on `role === "Valet & Parts"`. Only the list rendering changes.

## Technical notes
- No database migration needed.
- No changes to mobile SwipeRow behavior.
- `hideThreadForUser` already writes to `thread_hides` + localStorage, so the desktop delete button gives the same cross-device behavior as the mobile swipe.

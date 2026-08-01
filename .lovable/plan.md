## 1. Show clock times on pickup cards

In the pickup list (`src/routes/pickup.tsx`):

- Next to the submitter's name (the `car model · NAME` line), append the time the pickup was submitted, formatted as a clock time (e.g. `JOLEEN · 6:12 PM`), from the record's created timestamp.
- Replace "Claimed by Carlos · about 1 hour ago" with "Claimed by Carlos · 6:28 PM" using the claim timestamp.
- The unclaimed badge in the top-right keeps its relative "x min ago" wording so valets still see age at a glance (say the word if you'd rather it be a clock time too).
- Times use the viewer's local time zone via `date-fns` `format` (already a dependency).

## 2. Profile photos in New Message

The "New Message" screen (screenshot #2) is the one place still drawing the generic person icon. Its recipient list drops the avatar field that the directory already returns.

- Keep the avatar URL on each person when building the recipient list.
- Render the shared `Avatar` component (photo, initial fallback, tap-to-enlarge) in the people list and in the selected-recipient "To" row, matching the inbox and threads.
- Groups keep the multi-person icon.
- All other icon spots (inbox, threads, search popups, roster) already use real photos.

## 3. Un-clip the card outlines

The first pickup card's ring is being covered by the sticky header, which sits above the list with no gap.

- Add top spacing to the pickup list so the first card's ring sits fully below the header, and give the scroll container enough room that the ring is never overlapped.
- Applies to all card colors (blue customer, red technician, yellow parts) since they share the same wrapper.

### Technical notes

- Files: `src/routes/pickup.tsx`, `src/routes/compose.tsx`.
- No database or backend changes; `created_at` and `claimed_at` are already loaded, and `avatar_url` is already returned by `getMessageRecipients`.

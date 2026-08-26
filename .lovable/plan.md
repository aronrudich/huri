# Daily Huri Digests and Pull-to-Refresh

## Inbox digest behavior

- Give each 9 AM 14-day digest its own date-based Huri thread per recipient instead of reusing the permanent `huri:<user>` thread.
- Keep the existing one-list-per-dealership behavior, but make every new day appear as a separate inbox row; normal inbox date sorting will keep the newest daily list at the top.
- Use a stable Pacific calendar date in the thread identifier so duplicate scheduler calls on the same morning cannot create separate conversation rows.

## Unread state

- When a user opens any conversation, mark its unread messages as read in the database as today.
- Immediately update the shared message cache after that write so the blue unread dot disappears as soon as the user returns to the inbox, including for daily Huri lists.
- Preserve realtime updates so the read state stays synchronized across desktop and mobile sessions.

## Pull-to-refresh

- Add an app-wide pull-to-refresh interaction to the existing scroll container.
- Only activate the gesture when the screen is already at the top, show a visible spinner/progress indicator while pulling and refreshing, and trigger after a deliberate pull threshold to avoid accidental refreshes.
- On refresh, reconnect live updates and refetch active app data through the existing query/recovery system, without clearing cached content or changing current workflows.
- Keep the bottom navigation fixed and respect iPhone safe areas and normal scrolling.

## Validation

- Verify two different digest dates render as two separate Huri rows in newest-first order.
- Verify opening a daily digest clears its unread dot immediately on return to the inbox.
- Test the pull gesture on a mobile viewport, confirm the visible updating state, and confirm inbox/pickup/lot data refetch without layout jumps.

## Technical details

- Update the daily alert hook’s `thread_id` format to include the Pacific date and recipient ID.
- Synchronize the thread read mutation with all cached `messages` queries through TanStack Query.
- Add a small root-level refresh controller around `.app-scroll`, using touch events, semantic design tokens, query invalidation, router invalidation, and the existing realtime generation/reconnect path.

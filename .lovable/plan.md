
## Answers to your questions first

**Calls (voice/video between users):** Not currently possible in Huri, and not really a Lovable-native feature. To add it we'd have to integrate a third-party service like Twilio Voice, Daily.co, or Agora. That's a real amount of work (permissions, ringing UI, call screens, background handling on iOS PWAs is limited), and it would be billed by that provider directly — **not Lovable credits**. Lovable credits would only cover the tiny server-fn calls to create call tokens. My recommendation: skip calls for now; texting + push covers the dealership workflow. If you want it later, we can add a "Call" button that opens the person's phone dialer using their number — but you removed phone numbers earlier, so that's off the table too.

**Photos from library / camera:** Yes, fully possible. We'd add an image button in the message composer that opens the phone's photo picker (or camera on mobile), upload to Lovable Cloud Storage, and render the image in the thread. Credit impact:
- **Storage:** cheap. A typical phone photo is ~2–4 MB. Even 500 photos/month = ~1.5 GB — a few credits/month at most.
- **Egress (viewing photos):** this is the bigger driver. If 50 employees each view ~20 photos/day, that's ~60 GB/month of image traffic. Rough estimate: **~15–30 extra credits/month** on top of the numbers we already discussed.
- **No AI credits** unless you want auto-captioning / OCR on RO tags in photos.

Let me know if you want photo attachments added — it's a ~1 build session change.

## Changes I'll make in this plan

### 1. Unread indicator on the inbox (iMessage-style blue dot)
- Add `messages.read_at timestamptz` column (nullable) with a migration + GRANT.
- RLS: allow a user to UPDATE `read_at` only on messages they can already SELECT (i.e. messages addressed to them or their role group).
- When a user opens `/thread/$threadId`, mark all messages in that thread where they are a recipient (direct recipient, or role-group member, or group starter) and `read_at IS NULL` as read (`update ... set read_at = now()`).
- In `src/routes/index.tsx`, compute `unread = thread has any message not sent by me with read_at IS NULL AND created_at > thread cutoff`. Show a small blue dot (●) on the left of unread rows and bold the title/preview, matching iMessage.
- Realtime already streams inserts; also subscribe to UPDATE so the dot clears live when read on another device.

### 2. Pickup rows disappear 60 min after "Claim"
Already partially implemented (auto-archives claimed pickups + parts requests after 60 min via `archive_stale_pickups` and the client-side interval). I'll:
- Verify both paths — the client interval in `src/routes/pickup.tsx` currently only clears items with `ro_number`; extend it to also archive claimed **parts** requests (no RO#) so those disappear too.
- Confirm the query filter `neq("status","completed")` hides archived rows immediately after the update fires.

### 3. Dealership shown on profile page
- Extend `useAuth`/profile fetch to include `dealership_id` → dealership `name` (join or a second lookup against the `dealerships` table).
- Render "**Dealership:** Ontario Jeep Chrysler Dodge Ram Fiat" as a read-only field near the name/role block on `/profile`. Not editable by the user (dealership assignment stays admin-controlled).

## Technical details

- Migration:
  ```sql
  alter table public.messages add column read_at timestamptz;
  create index if not exists messages_thread_read_idx on public.messages (thread_id, read_at);
  ```
  Plus an RLS UPDATE policy scoped to recipients only; no new GRANT needed (authenticated already has UPDATE on `messages`).
- Mark-as-read call batched with `supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('thread_id', threadId).is('read_at', null).neq('sender_id', user.id)`.
- Inbox unread state: derived per-thread from the same `messages` array already loaded — no extra query.
- Dealership lookup: single `supabase.from('dealerships').select('id,name').eq('id', profile.dealership_id).maybeSingle()` on profile mount, cached in state.

## Out of scope (explicitly, until you say go)
- Voice/video calling
- Photo/image attachments in messages
- Read receipts visible to the *sender* (iMessage-style "Read 3:42 PM"). This plan only shows *the recipient* which of their own inboxes are unread. Say the word and I'll add sender-visible read receipts too.

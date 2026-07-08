## Answers to your questions first

- **Desktop and mobile are the same app.** One codebase, one database. Anything I change ships to both instantly. Push notifications are the only thing that's mobile-only (iOS/Android home-screen PWA) — everything else is identical.
- **Group chats today are shared** (one "Valets" chat everyone drops into). You want per-starter threads — I'll rebuild that below.

## Plan

### 1. Add "Valet & Parts" to the role picker (DB fix)
The code already lists it in the fallback, but the `roles` table in the DB doesn't have a row for it — so when the sheet loads DB roles, the fallback is overridden. Insert the missing row via migration:
```
INSERT INTO public.roles (name) VALUES ('Valet & Parts') ON CONFLICT (name) DO NOTHING;
```

### 2. Red styling for tech-originated alerts
Two sources count as "tech-originated": pickup requests submitted by a Technician, and Parts requests (which are Tech-only by definition).

- **DB:** add `source_role text` column on `pickup_requests`, stamped at insert with the submitter's `role_name`. Backfill existing rows to `'Advisor'`.
- **Pickup list card (`src/routes/pickup.tsx`):** if `source_role === 'Technician'`, swap the card accent — red border, red "Claim" button, red status pill, red warning banner — instead of blue/neutral. Everything else stays blue.
- **Push notifications:** add a `variant: 'tech' | 'default'` field to the push payload. Service worker (`public/sw.js`) reads it and sets a red badge/icon for tech pickups and all Parts alerts. Notification title gets a 🔧 prefix so it's obvious at a glance on lock screen even before the icon renders.
- Blue stays the default for everything else (advisor pickups, messages, system).

### 3. Group chat model — per-starter threads
Right now `thread_id = "group:{roleId}"` means every employee shares one Valets chat. Switch to **one thread per (starter, targetRole)** so each employee has their own private group with the Valets, and the Valets end up with many parallel Valet-group threads (one per employee who's messaged them).

- **Thread key:** `group:{roleId}:{starterUserId}` — the person who first composed to that group owns the thread.
- **Visibility rules (RLS + inbox query):**
  - The starter always sees their thread.
  - Members of `roleId` see the thread only if it has messages (i.e., they've been messaged in it).
  - Non-members / non-starters see nothing.
- **Notifications:**
  - Starter sends → notify only members of `roleId` (unchanged behavior, already scoped).
  - A member replies → notify only the starter (not other members of the role). Implemented in `sendMessagePush` by checking whether the sender is a member of the thread's target role and, if so, routing the push to `starterUserId` only.
- **Inbox list (`src/routes/index.tsx`):** label these threads as e.g. "Valets (group) · started by Alex" for members, and "Valets (group)" for the starter. Old shared `group:{roleId}` threads: migrated to `group:{roleId}:{originalSenderId}` using the earliest message's sender.
- **Compose (`src/routes/compose.tsx`)** and **thread view (`src/routes/thread.$threadId.tsx`)**: update the thread-id builder and the group-parsing (`threadId.slice(6)` → parse `roleId` and `starterId` from the new format).

### 4. Technical notes (skip if not interested)
- New pickup column: `ALTER TABLE public.pickup_requests ADD COLUMN source_role text;`
- Backfill: `UPDATE public.pickup_requests SET source_role = 'Advisor' WHERE source_role IS NULL;`
- New RLS SELECT policy on `messages`: allow read if `sender_id = auth.uid()` OR `recipient_id = auth.uid()` OR (`recipient_role_id IN (my roles)` AND `thread_id` starts with `group:{that role}:`) OR (`thread_id` = `group:*:auth.uid()`).
- Service worker: read `data.variant` from the push JSON, pick red vs. blue icon/badge PNGs (I'll generate two 192px badges).
- No changes to auth, approval flow, or lot logic.

### What I will NOT touch
- Approval/pending system, owner powers, spot-blocking math, Park form, video assets, `_authenticated` layout, auto-generated Supabase files.

Ready to build on your go-ahead.
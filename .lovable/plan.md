# Approval & Account Control System

## What you'll get

1. **You become the Owner.** Your account (`aron@oremor.net`) gets a new permanent role flag — `is_owner = true` — separate from job role. Job role changes to **Manager**. The Owner power can later be transferred to anyone else with one click.
2. **No one gets in without your approval.** When a new person signs up, their account is created in a `pending` state. They immediately see a full-screen popup: *"Waiting for approval from the dealership owner. You'll get in as soon as Aron approves you."* They cannot message, park, pickup, or view the lot until approved.
3. **Role changes require approval too.** Anyone can request a role change from their profile. Their role stays the same until you approve. Shows "Pending: Technician" next to their current role.
4. **Owner Approvals tab.** A new tab inside your profile, visible only to the Owner, listing every pending item (new signups + role-change requests) with one-tap **Approve** / **Deny** buttons.
5. **You get notified instantly.** Every new signup or role-change request fires a push notification to your phone.
6. **Removal = full deletion.** When someone is removed (by you) or leaves voluntarily, their auth account + profile + messages + push subscriptions are **deleted from the database**. They can sign up again with the same email, but they'll be `pending` again.
7. **Search & open anyone.** From your profile (Owner only), a search box lets you find any active employee by name and tap into their mini-profile, where you can change role or remove them.
8. **Transfer ownership.** Owner-only button: "Transfer ownership to…" — pick any active employee, confirm, and they become Owner; you lose the powers immediately.

## Technical details

### Database changes (one migration)
- `profiles`: add `is_owner BOOLEAN DEFAULT false`, `status TEXT DEFAULT 'pending' CHECK status IN ('pending','approved')`, `pending_role_name TEXT NULL`.
- New `pending_approvals` view (or just query profiles directly) — actually no view needed; simple queries.
- Backfill: set every existing profile to `status = 'approved'`. Set `is_owner = true` for `aron@oremor.net` and `role_name = 'Manager'`.
- RLS: tighten directory/messages/parked_cars/pickup_requests so only `status='approved'` profiles are visible to others and can write. Owner bypasses via `is_owner` check.
- `has_role`-style helper: `public.is_owner(uuid)` SECURITY DEFINER.

### Account lifecycle
- `createConfirmedAccount` server fn: new profiles start `status='pending'`, then notify the Owner via push.
- New `approveAccount(userId)` / `denyAccount(userId)` Owner-only server fns.
- New `requestRoleChange(newRole)` (any user) → writes to `pending_role_name`, notifies Owner.
- New `approveRoleChange(userId)` / `denyRoleChange(userId)` Owner-only.
- `removeEmployee` and `leaveDealership` switch from soft-deactivate to **hard delete**: `supabaseAdmin.auth.admin.deleteUser(id)` (cascades clean up profile, messages, push subs via existing FKs / explicit cleanup).
- `transferOwnership(newOwnerId)` Owner-only fn.

### UI changes
- **Auth screen / signup success**: full-screen "Waiting for approval" gate. Polls profile status; auto-enters when approved.
- **Auth context**: if `profile.status === 'pending'` → render PendingGate, block all routes.
- **Profile page (Owner only)**: new "Approvals (N)" section at top showing pending signups + role requests with Approve/Deny. New "Find employee" search. New "Transfer ownership" button at bottom.
- **Profile page (everyone)**: "Request role change" button next to current role; shows "Pending: X" badge while waiting.
- Removes Director-as-admin logic — replaced entirely by `is_owner`. Existing roster + remove still works for Owner.

### Notifications
- Reuses existing `sendMessagePush` pipeline; new helper `notifyOwner(title, body)` queries owners and pushes.

### Files touched
- 1 migration (schema + backfill + RLS + helper fn)
- `src/lib/auth.functions.ts` (pending status on signup, owner notify)
- `src/lib/admin.functions.ts` *(new)* — approve/deny/transfer/delete fns
- `src/lib/auth-context.tsx` (expose `status`, `is_owner`)
- `src/components/PendingGate.tsx` *(new)*
- `src/routes/__root.tsx` or `_authenticated/route.tsx` (mount PendingGate)
- `src/routes/profile.tsx` (Approvals section, search, transfer, role request)
- `src/components/ChangeRoleSheet.tsx` (used by Owner — direct change, no approval needed for Owner)
- `src/components/RequestRoleSheet.tsx` *(new)* — for normal users

## Confirmations before I build

1. **You = the only initial Owner.** I'll hard-code `aron@oremor.net` in the migration to flip `is_owner=true` and `role_name='Manager'`. ✅
2. **Hard delete on removal/leave** — gone from auth + database, must re-signup. ✅
3. **Role changes are pending until you approve** — current role stays active in the meantime. ✅
4. **You get push notifications for every approval needed** (uses your existing mobile push setup). ✅

Reply "go" and I'll ship it.

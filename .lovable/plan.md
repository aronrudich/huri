# Security & Correctness Hardening Pass

Fix all 12 items from the review. No visible change for employees; the only user-facing effect is notifications becoming more reliable.

## Database (new migrations only)

1. **Pending accounts can't read data** — rewrite the SELECT policies on `parked_cars`, `pickup_requests`, `car_events`, `car_washes`, `messages`, and `thread_hides` to also require the caller be approved and active (via the existing `private.is_approved` / active-employee helpers), not just same-dealership.
2. **Tenant scoping on writes** — add `dealership_id = private.dealership_of(auth.uid())` to the UPDATE `USING`/`WITH CHECK` and DELETE `USING` clauses on `parked_cars` and `pickup_requests`.
3. **Self-escalation** — add `dealership_id` to the `prevent_profile_self_escalation` trigger guard and to the "users update own profile" policy's `WITH CHECK`.
4. **Push subscriptions** — add the missing `FOR UPDATE` policy so upsert-by-endpoint works.
5. **Atomic spot assignment** — new `assign_lot_position(...)` function that locks the target rows with `SELECT ... FOR UPDATE` and checks/assigns numbered spots in one transaction (displacing an occupant to `UNKNOWN` as today). No unique constraint, so `BL`/`CP`/`UNKNOWN`/custom spots keep sharing freely.
6. **Indexes** — `dealership_id` indexes on `parked_cars`, `pickup_requests`, `messages`.
7. **Realtime** — `REPLICA IDENTITY FULL` on those same three tables.

## Server code

- `createConfirmedAccount`: reject any self-registration whose `roleName` is in the management/admin sets (the sanitize trigger doesn't fire for service-role writes); force a safe default and surface a clear error.
- `push-server.server.ts`: no hardcoded VAPID private key — read from env and throw a config error when missing. Rotate to a fresh keypair.
- Cron webhooks (`unclaimed-reminder`, `stale-cars`): require a dedicated `CRON_WEBHOOK_SECRET` header instead of the publishable anon key; update the scheduled jobs to send it.
- Push sender: treat `401`/`403` from web-push as stale alongside `404`/`410` and prune those rows.
- `searchCars`: reject/escape commas and parentheses in the query before building the PostgREST `.or()` filter.

## Client code

- `park.tsx`: replace the sequential lookup-then-update with a single call to the new `assign_lot_position` function (same confirmation prompts).
- `push.ts`: record the VAPID key fingerprint next to the notification preference; on every register/sync, if it differs from the current key, unsubscribe, delete the old row by endpoint, resubscribe with the new key, and upsert — silent, no prompt.
- Sign-out: clear the `huri.query-cache.v1` localStorage key on every logout path.

## Secrets needed

Two new backend secrets: `VAPID_PRIVATE_KEY` (new rotated key) and `CRON_WEBHOOK_SECRET`. The new public VAPID key goes into `VITE_VAPID_PUBLIC_KEY`.

## Verification

- Query as a pending profile and confirm reads on `parked_cars` / `pickup_requests` / `messages` return nothing.
- Attempt a self `dealership_id` update and confirm it's rejected.
- Two concurrent assignments to the same numbered spot: only one wins.
- Simulate a rotated key on a device with an existing subscription and confirm silent re-registration.
- Deliver the full updated source as a downloadable zip at the end.

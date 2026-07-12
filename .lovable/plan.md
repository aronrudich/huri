## Problem

The last security fix revoked `EXECUTE` on the `SECURITY DEFINER` helpers, including the `private.*` ones used inside RLS policies (`private.is_approved`, `private.dealership_of`, `private.is_owner`, `private.user_in_role_group`, plus `private.is_admin` / `private.is_manager`). RLS policies execute as the calling role (`authenticated`), so when those helpers can't be executed, every policy silently evaluates to false and the app looks wiped: no messages, no cars, no pickups, no profiles, no dealership.

The `private` schema is not exposed through the Data API, so granting `EXECUTE` to `authenticated` on those helpers restores the app without re-opening the original finding (which was about `public.*` definers being reachable via PostgREST).

## Fix (one migration)

Restore `EXECUTE` on the `private.*` RLS helpers to `authenticated`, and keep everything else locked down:

```sql
GRANT EXECUTE ON FUNCTION
  private.is_approved(uuid),
  private.is_owner(uuid),
  private.is_admin(uuid),
  private.is_manager(uuid),
  private.dealership_of(uuid),
  private.user_in_role_group(uuid, uuid)
TO authenticated;
```

`private.is_active_employee` already has this grant. `public.*` definer functions stay revoked (they were the actual finding).

## Verification

- Reload the app, confirm inbox, pickup queue, lot, and profile all show data again.
- Re-run the linter to confirm the original findings are still resolved.

No client code changes.
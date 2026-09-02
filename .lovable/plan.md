# Exclude canceled requests from Reports

## What's happening now

Canceling a pickup in the queue does not record a cancel — it writes the same
`completed` status that a finished job gets. Every one of the 1,240 requests in
the database is currently marked `completed`, so Reports has no way to tell a real
claim from a canceled one and counts both.

## The fix

1. **Record cancels as cancels.** The Cancel button will set the status to
   `canceled` (plus a cancel timestamp) instead of `completed`. Car history already
   knows how to display a "Canceled" event, so the car timeline gets more accurate too.
2. **Reports ignore canceled rows.** Both the Claiming and Submitting tabs drop
   canceled requests before counting: not in totals, not in per-employee claims or
   submissions, not in averages, not in the type breakdown.
3. **Queue behavior unchanged.** A canceled request still disappears from the pickup
   list, the car still returns to its original spot, and staged flags still clear.

## Note on past data

Historical cancels were saved as `completed` and are not distinguishable after the
fact, so older reports will still include cancels made before this change. Everything
canceled from now on is excluded.

## Technical details

- `src/routes/pickup.tsx`: cancel handler updates `status: "canceled"`; keep the list
  filters treating anything not `unclaimed`/`claimed` as gone from the queue.
- `src/lib/reports.functions.ts`: filter `status <> 'canceled'` (accept the
  `cancelled` spelling too) right after the query, before all aggregation, so
  `total`, `claimed`, `unclaimed`, `avgMs`, `anomalies`, employees, submitters and
  kinds all derive from the filtered list.
- No migration needed: `status` is free text and the pickup triggers already handle
  a `canceled` transition.

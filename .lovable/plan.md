# Reports: submissions by employee + claimed-list order

## Reports screen

Reports gets two sub-tabs under the time-range row:

- **Claiming** — exactly what exists today (summary cards, employee leaderboard with claims/avg/fastest/over-20m, breakdown by submission type).
- **Submitting** — a new view about who is *using* the app. No timing at all, just counts:
  - Summary: total submissions in the range, number of distinct employees who submitted.
  - One row per employee who submitted anything: avatar/rank, name, role, total submissions (sorted highest first).
  - Tap a row to expand into that employee's breakdown by type (Pickup, Stage, Parts, Park, Wash, Shuttle).

Both sub-tabs share the same time range (Today / 7 Days / 30 Days / All Time / Custom) — switching sub-tabs keeps the range you picked.

## Pickup list order

Unclaimed submissions keep today's behavior exactly: customer requests first, then technician requests, then staged cars, each oldest-first.

Claimed submissions (the group below) flip to **most recently claimed at the top**, so the newest activity is easiest to see as claims come in. They still disappear from the list 60 minutes after being claimed.

## Technical notes

- `src/lib/reports.functions.ts`: the existing query already selects `created_at`; add `requested_by` to the select. Build a second aggregation map keyed by `requested_by` (`submissions` count + `byKind`), resolve names/roles from the same `profiles` lookup (merge the id set so it stays one query), and return `submitters: SubmitterStat[]` plus `submittedTotal` and `submitterCount` on `ReportData`. Rows with a null `requested_by` (system/deleted) group under a single "Unknown" bucket or are skipped — skip them to keep the leaderboard about real accounts.
- `src/routes/reports.tsx`: add `const [view, setView] = useState<"claiming" | "submitting">("claiming")` with a two-button segmented control below the range tabs; render the existing sections when `claiming`, and the new submitter list when `submitting`. Reuse `Stat`/`Mini` and existing expand pattern; no new query key needed since one server call returns both datasets.
- `src/routes/pickup.tsx` (`sortedPickups`, ~line 253): reverse the claimed comparator to `new Date(b.claimed_at ?? b.created_at) - new Date(a.claimed_at ?? a.created_at)`. Unclaimed groups untouched.

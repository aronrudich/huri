# Reports tab + Spectator role

## What you get

A new **Reports** entry in the Actions menu, visible only to Admin, Service Manager, Service Director, General Manager, Spectator (and the owner account). It opens a dedicated Reports screen.

### Time range selector
Four tabs at the top: **Today · 7 Days · 30 Days · All Time**.

"Today" runs on the shift day you described: it starts at 6:30 AM Pacific and covers through 6:30 PM. At 6:30 AM Pacific the "Today" numbers reset. The 7-day and 30-day windows are built out of those same shift days, so they always start at a 6:30 AM boundary. All existing historical submissions are included — nothing needs to be re-recorded.

### Section 1 — Summary cards
- Total submissions in the range
- Total claimed
- Still unclaimed
- Average claim time across the dealership (anomalies excluded)

### Section 2 — Employee leaderboard
One row per employee who claimed something, sorted by claim count (highest first). Each row shows:
- Avatar + name + role
- Total claims (this includes anomaly claims — they always count toward the employee's total)
- Average claim time (anomaly claims excluded from the average)
- Fastest claim
- Number of anomalies (claims that took over 20 minutes), shown as a small muted note

Tapping a row expands it to show that employee's breakdown by submission type (Pickup, Stage, Parts, Park, Wash, Shuttle).

### Section 3 — By submission type
For the selected range: count, claimed count, and average claim time per submission type, so you can see e.g. that parts requests sit longer than pickups.

### Anomaly rule
A claim that took more than 20 minutes from submission to claim is excluded from every average and "fastest" figure, but is still counted in the employee's total claims and in the dealership totals. Anomaly counts are shown separately so you can see how often it happens.

## Spectator role

- Added to every role picker (registration, role-change request, manager's change-role sheet) and inserted into the roles table.
- Spectators can sign in and browse: inbox, pickup list, lot list/map, car history, profiles, and Reports.
- Spectators cannot submit anything (no Actions except Reports), cannot claim or cancel submissions, and cannot send messages — the compose button and thread input are hidden for them, and the database rejects writes from the role as a backstop.
- Spectators still receive nothing from the pickup notification fan-outs.

## Technical notes

- `src/lib/roles.ts`: add `"Spectator"` to `ROLE_OPTIONS`, add `isSpectatorRole`, add `REPORTS_ROLES` (`Admin`, `Service Manager`, `Service Director`, `General Manager`, `Spectator`) + `canViewReports`. `actionsForRole("Spectator")` returns `[]`; add a `reports` action id appended for report-eligible roles so it renders in the Actions dropdown.
- New route `src/routes/reports.tsx` with its own `head()` metadata; guarded client-side by `canViewReports` (redirect to `/` otherwise).
- New `src/lib/reports.functions.ts` — a `requireSupabaseAuth` server fn returning aggregated stats for a given range key. It re-checks the caller's role server-side, computes the 6:30 AM Pacific shift boundary (fixed `America/Los_Angeles`, DST-aware), and aggregates `pickup_requests` (`created_at`, `claimed_at`, `claimed_by`, `kind`, `status`) joined to `profiles` for names/roles. Called via `useQuery` from the component, not a loader.
- Migration: insert `Spectator` into `public.roles`; extend the `private.is_active_employee` / message-insert guards to exclude `role_name = 'Spectator'` so read-only enforcement is real.
- Messaging UI: hide compose/send for spectators; `push.functions.ts` fan-outs already filter by role lists, Spectator is simply never added.

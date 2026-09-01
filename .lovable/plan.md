# Fix the Submitting tab crash in Reports

## What's happening

Pressing **Submitting** drops you on the "Something went wrong" screen instead of the report.

The data itself is fine: there are 1,186 submissions going back to June 20, and 1,155 of them
have a recorded submitter — so once the screen renders, the Submitting view will cover the same
full history as the Claiming view (All Time and Custom ranges included).

The most likely cause is the saved-report cache. Huri stores the last report result in the
browser for fast reopening, and that saved copy was created before the Submitting numbers
existed. When the tab renders, it reads submitter fields that the old saved copy doesn't have and
the screen errors out. This diagnosis isn't confirmed yet, so step 1 is to reproduce it and
confirm before changing anything.

## Fix

1. Reproduce: open Reports and switch to Submitting in the preview to capture the exact error.
2. Bump the saved-cache version so every device starts from a fresh, correctly shaped report
   instead of an outdated one.
3. Make the Submitting view tolerant of missing fields, so a stale or partial report shows zeros
   or a loading state rather than crashing the whole page.
4. Re-verify: Today, All Time, and a Custom range on both sub-tabs, checking that Submitting
   shows historical employees and counts.

## Technical notes

- `src/lib/query-persist.ts`: change `KEY` from `huri.query-cache.v1` to `v2` (old entry is
  orphaned and expires; no migration needed).
- `src/routes/reports.tsx`: read submitter data defensively — `data.submitters ?? []`,
  `data.submittedTotal ?? 0`, `data.submitterCount ?? 0` — and guard `Object.entries(s.byKind ?? {})`.
- `src/lib/reports.functions.ts`: no query change needed; `requested_by` is already selected and
  the range windows are shared with the Claiming view, so history coverage is already identical.
- Confirm with a Playwright pass against the Reports route (owner session) plus browser console
  output rather than declaring it fixed from the code alone.

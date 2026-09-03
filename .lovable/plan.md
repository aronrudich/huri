# Accurate reports and a CP-free 14-day list

## 1. 14-day list skips CP

The morning digest currently includes cars in BL, CP, and SV spots. CP will be
dropped, so only BL and SV cars can appear on the 14-day list.

## 2. Reports counted only the first 1,000 requests

The database caps any single read at 1,000 rows. There are 1,311 pickup requests
in history, so "All time" reports were silently missing the oldest ~300. The
report will now page through the data in 1,000-row batches until everything is
loaded, so every range — especially All time — reflects 100% of history.

## 3. Canceled submissions are fully ignored

Canceled requests are already dropped before any counting, which means they are
excluded from totals, per-employee claims, submissions, averages, fastest times,
anomalies, and the type breakdown. That stays, and will now apply across the
complete (un-truncated) history.

Note on old data: cancels made before the cancel status existed were saved as
"completed" and cannot be told apart afterwards. 4 requests carry the canceled
status today; only 6 cancel events exist in car history, so the impact on older
numbers is negligible.

## Technical details

- `src/routes/api/public/hooks/stale-cars.ts`: change the location filter from
  `lot_position.eq.BL,lot_position.eq.CP,lot_position.like.SV %` to
  `lot_position.eq.BL,lot_position.like.SV %`.
- `src/lib/reports.functions.ts`: replace the single `.limit(20000)` query with a
  loop using `.range(offset, offset + 999)` on a stable `created_at, id` order,
  accumulating rows until a batch returns fewer than 1,000 (hard stop at 50k).
  Same for the roster read if it ever exceeds 1,000 profiles.
- Aggregation logic is unchanged; it already filters `canceled`/`cancelled`
  before every stat.
- No migration needed.

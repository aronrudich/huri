# Custom date range for Reports

## What you get

A fifth tab next to Today / 7 Days / 30 Days / All Time: **Custom**.

Tapping it opens a small calendar panel:

- Month grid with arrows to move between months (can't go past the current month).
- Tap a day to set the start, tap a second day to set the end. The range in between highlights, same feel as the credit-usage calendar in the video.
- The selected range is shown as text (e.g. "Aug 12 – Aug 28") with a **Clear** option.
- Reports refresh as soon as both dates are picked; picking a single day gives that one shift day.

Days still follow the Huri shift rule: a picked day starts at 6:30 AM Pacific, and the end day runs through 6:30 AM the morning after it, so a custom range lines up exactly with the existing Today / 7 Days numbers. All the same sections (summary cards, employee leaderboard, breakdown by submission type) and the 20-minute anomaly rule apply unchanged.

## Technical notes

- `src/lib/report-range.ts`: add `"custom"` to `RangeKey` plus label; export `shiftDayStart(y, m, d)` and `shiftDayEnd(y, m, d)` helpers that convert a Pacific calendar date into the 6:30 AM boundary instants, reusing the existing `laWallToUtc`.
- `src/lib/reports.functions.ts`: input validator accepts `{ range: "custom", start: "YYYY-MM-DD", end: "YYYY-MM-DD" }` (validated shape, end >= start, both required for custom). Handler computes window start/end from the two dates and adds a `.lt("created_at", end)` bound; existing ranges keep behaviour unchanged. `ReportData` gains an optional `rangeEnd`.
- New `src/components/DateRangeCalendar.tsx`: self-contained month-grid range picker built with existing tokens (no new dependency — the project has no shadcn calendar/popover installed and `react-day-picker` isn't present). Buttons use semantic classes; touch targets sized for mobile.
- `src/routes/reports.tsx`: tab row becomes 5 items (wraps/scrolls on narrow screens), renders the calendar panel when Custom is active, holds `{start, end}` state, includes them in the `useQuery` key, and only fires the query once both dates exist.

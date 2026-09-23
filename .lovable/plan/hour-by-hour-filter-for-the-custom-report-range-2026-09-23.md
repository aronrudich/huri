# Hour-by-hour filter for the Custom report range

## What you get

On the Reports screen, when the **Custom** tab is active, a new **"Custom hours"** row sits directly below the calendar.

- It starts collapsed — one tap on it expands it, tap again to collapse.
- Expanded, it shows two pickers: **From** and **To**, each listing the hours of the day (12 AM, 1 AM, … 11 PM).
- Picking both hours narrows the report to submissions made between those hours on each day in the chosen date range (e.g. Aug 12–28, only 9 AM–2 PM activity).
- The selection shows in the collapsed row too ("9 AM – 2 PM"), with a **Clear** option to go back to all hours.
- Default is unchanged: no hour filtering — everything between 6:30 AM boundaries counts, exactly as today.
- Hours are Pacific time, matching the rest of the reports. Applies to both the Claiming and Submitting views and every section (summary cards, leaderboards, by-type breakdown). The 20-minute anomaly rule is untouched.
- Only available on the Custom tab — Today / 7 Days / 30 Days / All Time keep working exactly as they do now.

## Technical notes

- `src/lib/report-range.ts`: export a `pacificHour(date)` helper (wraps the existing `laParts`) that returns the 0–23 Pacific hour of an instant.
- `src/lib/reports.functions.ts`: input validator accepts optional `startHour`/`endHour` (integers 0–23, both required together, start < end, only allowed with `range: "custom"`). After the existing date-window fetch, the handler filters rows whose Pacific hour of `created_at` falls within `[startHour, endHour)` — per-row hour math keeps DST correct across multi-day ranges. No change when hours are omitted.
- `src/components/DateRangeCalendar.tsx`: no change.
- New small section in `src/routes/reports.tsx`: collapsible "Custom hours" panel below the calendar (chevron, two `<select>`-style hour pickers styled with existing tokens, Clear button). Hours held in state, included in the `useQuery` key, and only sent when both are chosen; the query stays enabled for date-only custom ranges.

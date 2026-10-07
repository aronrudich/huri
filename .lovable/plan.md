# Line up "Unlogged locations" with the airtight rule set

The plan and your rule set match. Four small gaps need closing so the code does exactly what the rules say.

## Gaps fixed

1. **Parts requests are ignored.** They say nothing about where a car is, so they never count as the "next request" and never clear or cause a deduction.
2. **Stage requests count as a "next pickup".** A stage ticket gets judged by its snapshot location, the same way a customer pickup is.
3. **"Car Has Been Picked Up" shortcut rows are ignored.** They're bookkeeping, not real requests.
4. **Valet window uses the later end.** The window runs from claim until 30 minutes after claim, or 30 minutes after the card left the list, whichever is later. This is how it already works, and it stays.

## Final rules

**Technician (-1.0, "Unlogged locations")**
- Start: a completed tech pickup. The car reached the bay at claim time.
- Find the next request for that car that isn't canceled, parts or the picked-up shortcut.
- If there's no next request, nothing happens (the car is still in the bay).
- If the next request is a park or wash request, it was a proper hand-off and nothing happens.
- If the next request is a customer, tech or stage pickup, look at the location it showed when it was submitted:
  - Bay, "Bay — [Tech]" or Unknown means -1 to the tech who requested the earlier pickup.
  - Any real spot (SV, BL, CP, Tow In, Other and so on) means it was logged, so nothing happens.
- Cars that were never in Huri before have no earlier tech pickup, so nobody is penalized.

**Valet (-1.0)**: unchanged. A claimed park request with no real spot logged in the window costs the claiming valet 1 point.

**Locations logged (+0.3)**: unchanged. Points go only to manual moves to real spots. Moves to Bay, Taken, Wash or Unknown earn nothing, and neither does a move to CP within 30 minutes of a completed staging request.

## Technical details

In `src/lib/reports.functions.ts`, rule (b):
- Build `byRo` from `live` with rows removed where `status === "picked_up"` or `kindOf(r) === "parts"`.
- `next` = first row with `id !== r.id && created_at > arrived`.
- Keep the early returns for park and wash requests, plus the `inHours(next.created_at)` and range-start guards.
- Replace the `realMoveIn(...)` check with a snapshot check: `const snap = normalizeSpot(next.lot_position)`. Penalize when `!snap || snap === "UNKNOWN" || snap === "BAY" || snap.startsWith("BAY ")`.
- Rule (a) and the +0.3 loop stay as they are. Run the typecheck afterward, and never use the word "stall".
- Spot-check Ivan's last 30 days afterward. He should show about 1 deduction.

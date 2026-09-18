# Longer timer, split stats, named bays, auto-added cars, simpler history

## 1. Claimed items stay on the list for 30 minutes

The wait before a claimed submission disappears goes from 20 to 30 minutes, both in the app and in the background cleanup that finishes them, so both agree.

## 2. Stats split customer and technician pickups

In Reports, "Pickups" becomes two separate lines everywhere it appears (by type, per claimer, per submitter):

- **Customer pickups** — submitted by advisors, managers, everyone who isn't a tech
- **Technician pickups** — submitted by Technician or Shop Foreman

Stage, Parts, Park and Wash stay as they are. Totals and claim times are unchanged, just broken out.

## 3. Bay locations show the technician's name

Instead of "Technician Bay", a car sitting in a bay reads **Bay — Ivan Morales**, using the technician who asked for it. When no name was captured it falls back to "Technician Bay". This shows on car pages, the lot list, search results, and pickup cards.

## 4. Cars not in Huri get added when a pickup is submitted

Submitting any pickup for an RO that isn't in Huri creates that car right away with location **Unknown**, carrying over the RO, model and notes. It then follows the normal rules when the submission leaves the list (tech pickup → that tech's bay, customer pickup → Taken by Customer, staged → CP, wash → Wash).

## 5. History becomes short and readable

Each submission collapses into **one** entry instead of four or five. Example:

```text
Customer pickup · Sep 17, 2:40 PM
Requested by Maria (Advisor) · from SV 27
Picked up by Luis (Valet) at 2:46 PM
Note: keys in the box
```

- Claim, completion, auto-archive and reminder lines are folded into that single entry (an unfinished one reads "Still waiting" or "Claimed by Luis — not finished"; canceled ones say who canceled).
- Location changes stay as their own one-line entries ("SV 27 → CP").
- Kept as-is: added to Huri, deleted, notes, RO/tag/model edits.
- Dropped: duplicate note lines that repeat a note already shown, stage/unstage pairs (folded into the stage request), reminder-sent lines, and the separate "archived" line.

Old history stays readable — existing records are grouped by the same rules, nothing is deleted.

## Technical notes

- `src/routes/pickup.tsx`: `CLAIM_HIDE_MS` → 30 min; migration updates `archive_stale_pickups()` interval and its log text.
- `src/lib/reports.functions.ts`: `kindOf()` returns `pickup_customer` / `pickup_tech` based on `source_role`; `src/routes/reports.tsx` `KIND_LABELS` gains both keys.
- Bay name: add `bay_tech text` to `parked_cars`, set by `add_tech_car_on_pickup_complete()` from `advisor_name` when moving to `BAY`; `src/lib/lot.ts` label helpers accept an optional tech name so `BAY` renders "Bay — Name"; callers in `park.tsx`, `lot.tsx`, `pickup.tsx` pass it.
- Auto-add: in `createPickupAndNotify` (`src/lib/pickup-notifications.server.ts`), after the snapshot lookup, insert a `parked_cars` row with `lot_position 'UNKNOWN'` when no car matches the RO. Trigger `add_tech_car_on_pickup_complete` keeps its bay/CP/WASH/TAKEN moves.
- History: migration trims `car_events_from_pickups()` (drop `completed`, `reminder`, request-note events; keep `request`, `claimed`, `canceled`) and `car_events_from_parked_cars()` (drop `unstaged`); `archive_stale_pickups()` stops writing `archived` events. `src/components/CarHistory.tsx` fetches this car's `pickup_requests` rows alongside `car_events`, renders one card per submission (requester, snapshot spot, claimer + time, outcome, note) and hides the per-submission event rows it now represents.

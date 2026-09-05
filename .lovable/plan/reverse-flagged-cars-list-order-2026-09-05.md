# Reverse Flagged Cars list order

## Goal
Make the Flagged Cars list show the newest 14-day cars at the top and the oldest at the bottom.

## Changes
- `src/lib/queries.ts`: change `flaggedCarsQuery` ordering from `located_at ASC` to `located_at DESC`.
- `src/routes/flagged.tsx`: update the helper comment and the on-screen subtext that currently says "oldest first".

## Verification
- Open the Flagged Cars page and confirm the first row has the most recent `located_at` (fewest days parked) and the last row has the oldest `located_at` (most days parked).

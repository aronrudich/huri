# Fix pickup-list RO search at its source

## What is happening

RO **190596** still exists in Huri at **BAY**, but its pickup submission is now completed. The current search checks the phone's saved car list first and only uses currently active pickup cards as a fallback. Once that pickup leaves the list, both sources can miss the RO even though the live Huri record still exists.

## Fix

- Make the pickup-list search check Huri's current car records directly whenever someone enters an RO, model, or location.
- Keep the saved list for instant suggestions, but merge it with the current results so old phone data cannot hide a real car.
- Keep active pickup submissions as a final fallback for newly submitted cars, with duplicate ROs shown only once.
- Normalize spaces and capitalization when matching ROs so formatting differences do not cause misses.
- Show a brief searching state before showing “No cars match,” preventing a false empty message while the current lookup is still running.
- Opening a result will continue to open the existing car record for editing, not create another car.

## Verification

- Confirm **190596** appears even though its pickup is completed.
- Check several other completed and active pickup ROs, plus model and location searches.
- Confirm stale saved data cannot override current results and duplicate suggestions are not shown.

## Technical details

- Reuse the existing authenticated `searchCars` server lookup from the pickup screen instead of relying only on the persisted `parked-cars` cache.
- Run the lookup through the existing query cache with the normalized search text in its key, then merge live cars, cached cars, and visible pickup rows by normalized RO.
- Preserve all claim, sorting, notification, and pickup-card behavior.

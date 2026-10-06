# Build the private NAA lot-map sandbox

## What will be built

- Add an authenticated-only `/lot/naa-preview` test page with a clear “NAA Test Map” banner and no navigation links from onboarding or JCD screens.
- Render all 588 requested stall labels across five visually distinct property zones: Front Lot (45), Run Lanes (48), Main Yard (420), North Recon (40), and Transporters (35).
- Provide an entire-property view and focused zone views, with smooth mouse/touch pan and zoom plus reset and zoom controls.
- Add filter tabs and instant search by stall, mock stock number, or mock VIN; matching a result selects and centers its stall.
- Seed deterministic mock states for open, occupied, active pull, and staged stalls without reading or writing company data.
- Open a bottom drawer when a stall is selected. Empty stalls show a mock Park Vehicle action; occupied stalls show vehicle details and notes. Main Yard back stalls show their paired front-stall blocker and car details.

## Isolation and safety

- The preview will be frontend-only and use generated mock data held in memory.
- No database tables, company records, JCD map files, `/lot` behavior, or company code `JCD29854` will be changed.
- The route will redirect signed-out visitors to sign in and will have unique page metadata.

## Verification

- Confirm the route renders only for an authenticated session.
- Verify all five zone counts total exactly 588 and that filters/search/centering, zoom/pan, drawers, mock parking, and blocker details work.
- Check desktop and mobile layouts and confirm the existing `/lot` remains unchanged.

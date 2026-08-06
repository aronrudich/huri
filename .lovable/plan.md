# SV Lot Map + "Bay" Location Option

## 1. New "Bay" location option

Add **Bay** to the location drop-down, between **SV** and **Other**:

```text
BL     Back Lot
CP     Customer Parking
SV     Spots 1–147
Bay    In a tech's bay      <- new
Other  Custom location
```

- Selecting **Bay** saves the location as `BAY` (no extra input needed).
- `BAY` is treated like CP/BL: a valid location, not a numbered SV spot, and it does **not** appear under the SV/CP/BL tabs. It is still fully searchable (search "bay", the RO#, tag, or model) and shows up in the "Other locations" search group with the label `BAY`.

## 2. SV lot becomes a color-coded map

On the Lot tab, the SV list is replaced by a stall map that matches the real lot: 49 rows of 3 stalls, numbered 1–147 in row order (1,2,3 / 4,5,6 / … / 145,146,147).

- **Filled spot** = red fill, **open spot** = no fill (plain outline).
- Every stall shows its number, large enough to read at a glance on mobile.
- Tapping a stall opens the same car detail screen the list already opens (the existing park/edit popup). Tapping an empty stall does nothing.
- The map updates live exactly like the list does today (same realtime subscription).
- **CP and BL keep their current lists** — no maps until those lots get painted numbers.
- Search still works while the map is showing: typing narrows the map to matching stalls, and non-SV/custom/unknown matches still appear in the "Other locations" group below.

### Fitting the screen
The map is tall and narrow (3 wide, 49 deep), so:
- It renders inside a scrollable card that fills the available width on mobile and is centered with a sensible max width on desktop.
- Stalls scale with the container so nothing is clipped or squeezed on either form factor; numbers stay legible at mobile width.

## 3. Map button on each pickup card

Each pickup submission gets a **Map** button placed immediately to the **left of the Cancel button**.

- Pressing it opens the SV map in a full-screen overlay with the car's stall highlighted **blue** (filled stalls still red, open stalls uncolored).
- The general Lot-tab map never shows blue — highlighting is only for the pickup view.
- If the pickup's car isn't in an SV spot (CP, BL, Bay, custom, or unknown), the Map button is disabled/hidden since there's nothing to point at.

## Technical notes

- `src/lib/lot.ts`: add `BAY` as a recognized canonical location in `normalizeSpot` / `isValidSpot` / `locationChoice`, and make sure `lotOf` returns `null` for it and `isCustomSpot` excludes it so it lands in the searchable "other" bucket rather than a tab.
- `src/components/LocationPicker.tsx`: add the `BAY` option above `OTHER`, handled like `BL`/`CP` (immediate value, no detail input).
- New `src/components/LotMap.tsx`: renders rows of 3 stalls from `spotsForLot("sv")`, props `{ carsBySpot, highlightSpot?, onSelect }`. Pure presentation — colors come from existing semantic tokens (destructive for filled, primary for highlight).
- `src/routes/lot.tsx`: for the `sv` tab render `LotMap` instead of the `<ul>`, wired to the existing `byPos` map and the same `/park?id=` navigation; CP/BL branches untouched.
- `src/routes/pickup.tsx`: add the Map button next to Cancel plus an overlay that reuses `LotMap` with `highlightSpot` set from the card's `effectiveSpot` (only when it parses as an SV spot).

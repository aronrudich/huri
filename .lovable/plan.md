# Cleaner search badges + uniform pickup cards

## 1. Fix the spot badge in search suggestions

In the inbox and lot search dropdowns the round blue badge tries to fit long text
("UNKNOWN", "SV 129") into a small circle, so the words spill outside the dot.

Fix, applied the same way everywhere a spot badge appears in a search list:
- Show a short label only: `?` for unknown, `CP` / `BL` / `BAY` as-is, and for SV
  spots just the number (`129`) — never the raw `SV 129` or the word `UNKNOWN`.
- Keep the text inside the circle: single line, no wrapping, tighter font size,
  centered.
- The full readable location stays in the grey second line ("Spot SV 129",
  "Spot unknown"), which already reads correctly.

Screens touched: inbox search results, the pickup screen's car matches, and the
lot tab's suggestion dropdown — so all three look like the clean example.

## 2. Uniform pickup cards, colored label only

Right now each submission type recolors the whole card: a full-width colored
header bar plus a colored ring around the card, and the claim button changes
color too. That's what makes the list look busy.

New style, matching the reference screenshot:
- Every card is the same: white background, thin neutral border, same radius and
  padding. No colored rings, no full-width colored header bars.
- The type is shown as one small pill at the top-left of the card, with a bold
  colored word on a soft tint of the same color:
  - Pickup — Huri blue
  - Technician pickup — red (stays red, as today)
  - Park request — green (no longer red)
  - Parts — amber
  - Staged — dark/neutral outline (keeps the checkered treatment off the card,
    on the pill only)
- Submission time stays on the top-right of the card.
- The Claim button becomes one consistent style for every type; Cancel stays the
  light outline button next to it.
- The existing "Technician" source chip lower in the card keeps its red text so
  tech requests are still obvious at a glance.

No changes to who can claim, notifications, sorting, archiving, or any data.

## Technical notes

- `src/routes/index.tsx`, `src/routes/pickup.tsx`, `src/routes/lot.tsx`: replace
  the inline badge text with a shared short-label helper (added to
  `src/lib/lot.ts`, e.g. `spotBadge()`), plus `leading-none`/`whitespace-nowrap`
  and a smaller text size on the badge.
- `src/routes/pickup.tsx`: drop `ringClass` and `headerBar`; render a single
  `typePill` (label + token-based color classes) inside the card header row, and
  make the claim button always use the primary tokens.
- Colors come from existing semantic tokens (`primary`, `destructive`, `warning`,
  `success`, `muted`); a new token is added to `src/styles.css` only if the park
  color needs one.

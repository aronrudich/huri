# "Add/Edit Car" label and tappable RO numbers on pickup cards

## What will change

- The header Actions menu entry **Add Car to Huri** becomes **Add/Edit Car** (for roles that currently see it — valets, advisors, managers, etc.). Technicians keep seeing **Update Location** for the same destination. No, it's the same for everyone, including techs.
- On every submission card in the pickup list, the **RO #** text becomes tappable: pressing it opens that car's info/location page (`/park?ro=<number>`), the same page search results already open. Parts cards show their RO line tappable too.

## Behavior details

- Only the RO# text itself opens the car page — tapping anywhere else on the card still works exactly as today (claim, cancel, wash, etc.), since the cards are not links and only the new RO link is tappable.
- Cards whose submission has no RO number are unchanged.
- Opening a car this way is the existing vehicle/location page with its history, photos, and Save — nothing new is created.

## Technical details

- `src/components/BottomBar.tsx` line 81: `new: isTechRole(role) ? "Update Location" : "Add/Edit Car"`.
- `src/routes/pickup.tsx`: wrap the card title's `RO #…` span (line ~509) and the parts RO line (line ~531) in a `<Link to="/park" search={{ ro: p.ro_number }}>` styled to match current text (add underline/chevron affordance so it reads as tappable).

## Verification

- Search RO 190596 in the list, confirm the card's RO# opens the existing car record.
- Confirm claim/cancel taps still behave, and the Actions menu shows Add/Edit Car (Update Location for technicians).
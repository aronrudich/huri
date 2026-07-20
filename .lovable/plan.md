## 1. Displaced car should stay UNKNOWN, not Lot T

`src/routes/park.tsx` line 107: when a new car takes an occupied numbered spot, we currently do `update({ lot_position: "T" })` on the displaced car — which drops it into Lot T. Change that to `"UNKNOWN"` so the car has no lot but is still in the database. Update the confirm-dialog copy: "The other car will be marked location unknown."

Verify `src/lib/lot.ts` and `src/routes/lot.tsx`:
- `normalizeSpot` already returns `"UNKNOWN"` and `lotOf("UNKNOWN")` returns `null` — so UNKNOWN cars won't render in any of the three lot tabs. Good.
- Search on the Lot page: today the search filter runs on the currently-active lot's list, which excludes UNKNOWN cars. Extend the search to also scan a global "all cars" list (including UNKNOWN) so an UNKNOWN car appears in search results from any tab. Show a small "Location unknown" pill on those results.

## 2. Save button cut off on the Change Role sheet (mobile + desktop)

`src/components/ChangeRoleSheet.tsx` already has `max-h-[90vh]` and a flex-scroll list, but the roles list still pushes the Save button off-screen on short viewports because the outer sheet grows past the visible area on iOS Safari (100vh vs. visual viewport).

Fix:
- Swap `max-h-[90vh]` to `max-h-[100dvh]` and add `mb-[env(safe-area-inset-bottom)]` so the sheet respects the actual visible viewport and home-indicator inset.
- Tighten the roles list's own max height with `max-h-[min(60dvh,420px)]` so it can never eat the Save button, regardless of how many roles exist.
- Give the Save button a `pb-[env(safe-area-inset-bottom)]` wrapper so it clears the iOS gesture bar.

Result: Save is always visible on mobile and desktop, list scrolls internally.

## 3. Phone numbers replace email everywhere

You picked **phone-only replacing email**. Tradeoffs you accepted: Supabase still needs an email under the hood for auth, so signup will store a synthetic `<digits>@huri.local` email that the user never sees; **password reset by email will not work** — you'll reset passwords for people from the owner panel.

### Database
Migration on `public.profiles`:
- Add `phone_number text` (nullable at first so existing rows don't break).
- Add `unique (dealership_id, phone_number)` partial index where `phone_number is not null`.
- Backfill: leave existing rows' `phone_number` null; you'll fill yours in from the profile screen.

### Signup (`src/routes/auth.tsx`)
- Replace the Email field with a Phone Number field (`tel` input, `inputMode="tel"`).
- Normalize on submit to digits-only, prepend `+1` if 10 digits, reject anything shorter than 10 digits with `toast.error("Enter a valid phone number")`.
- Behind the scenes: call the existing admin-create server fn with `email = "<digits>@huri.local"`, `password`, and pass `phone_number` through so the profile row gets it. Login form: same — user types phone, we look up the synthetic email and sign in with that. (New server fn `resolveEmailForPhone` on `src/lib/auth.functions.ts`, publishable-key read on `profiles.phone_number → email`.)
- Copy: change "Email" labels to "Phone number" throughout auth.tsx.

### Profile page (`src/routes/profile.tsx`, `src/components/EditProfileSheet.tsx`)
- Replace the email row on the profile card with a phone number row (formatted like `(213) 555-0132`).
- In EditProfileSheet, drop the "Email" tab entirely. Keep "Info" and "Password". Add a "Phone" field to the Info tab that saves `phone_number` to `profiles`.
- Roster / directory (`src/lib/directory.functions.ts` + wherever it renders): show phone number under each name instead of email.

### Messages — tap-to-call
`src/routes/thread.$threadId.tsx`: in the header (next to the existing desktop Trash button) add a `Phone` icon button that renders as `<a href="tel:+1XXXXXXXXXX">`.
- Only show it for **1-on-1 threads** (not Group threads — there's no single number to call).
- Look up the other participant's `phone_number` from the thread's participants. If they don't have one saved, disable the button with tooltip "No phone number on file".
- The `<a>` uses the native `tel:` handler — no app-side routing, iOS/Android hand it to the carrier dialer.

## Technical notes

- No changes to Supabase auth provider settings — email/password stays enabled server-side; the synthetic email is invisible to users.
- Phone format stored as E.164 (`+1XXXXXXXXXX`); display format is US-friendly.
- Existing users without a phone number: they can still log in with email until they save one. The auth screen accepts either "phone or email" during a short transition — actually, since you said "replacing email everywhere," we'll add a small "Sign in with email (legacy)" link on the auth page so you can still get in until every account has a phone saved. Remove that link once everyone's migrated.
- Files touched: `src/routes/park.tsx`, `src/routes/lot.tsx`, `src/components/ChangeRoleSheet.tsx`, `src/routes/auth.tsx`, `src/routes/profile.tsx`, `src/components/EditProfileSheet.tsx`, `src/routes/thread.$threadId.tsx`, `src/lib/auth.functions.ts`, `src/lib/directory.functions.ts`, plus one migration for `profiles.phone_number`.
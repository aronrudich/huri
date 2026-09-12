# Customer pickups first, plus password reset

## 1. Customer pickups at the top of the pickup list

Right now the waiting cards are grouped: customer pickups and parts requests together, then technician pickups, then staged cars, then claimed cards. Parts and wash requests can therefore sit above a customer waiting at the door.

New order for waiting cards (each group oldest first):

1. Customer pickups (a pickup submitted by anyone who is not a technician or shop foreman, not staged) the blue pickups.
2. Technician pickups
3. Wash requests, parts requests, and park requests
4. Staged cars

Claimed cards stay below all waiting cards, newest claim first, exactly as today.

## 2. "Forgot password"

- A "Forgot password?" link under the password box on the sign-in screen.
- Tapping it asks for the email and sends a reset link to that address. The screen then says to check their email. No, it sends the email to the email that the user signed up with in their profile. It will tell the user to check that email account. 
- The link opens a new page in the app with one box: the new password, typed twice is not required, no rules at all — any password of any length is accepted.
- After saving, the page shows a short confirmation telling them to close and reopen Huri and sign in with the new password. It does not sign them in.
- If someone opens that page without a valid link, it says the link expired and offers to send a new one.

Password strength checking stays off, so nothing is rejected.

## 3. Downloadable copy of the code

I'll package the whole project into a single zip and attach it in chat once the changes above are in.

## Technical notes

- `src/routes/pickup.tsx`: rework `sortedPickups` into a priority bucket function (customer pickup / tech pickup / service request by `kind` in `wash`, `parts`, `park` / staged), keeping existing `byAge` and claimed ordering.
- Reset request: `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`, called from the sign-in screen in `src/routes/auth.tsx`.
- New public route `src/routes/reset-password.tsx` (top-level, not under `_authenticated`): waits for the recovery session via `onAuthStateChange` / `getSession`, then `supabase.auth.updateUser({ password })` with no `current_password` and no client-side validation beyond non-empty. Success state instructs a fresh sign-in; add a head() with its own title/description.
- Email/password auth is already enabled; confirm `password_hibp_enabled` is off so any password is accepted.
- Reset emails send through the project's default auth email templates — no custom email setup is required.
- Zip built with `git archive`-equivalent file copy excluding `node_modules`, `dist`, and `.git`, written to `/mnt/documents`.
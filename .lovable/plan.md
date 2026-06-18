## Disable email confirmation for new accounts

Turn off the "confirm your email before you can sign in" requirement in the backend auth settings, so new users are signed in immediately after registering.

### What I'll do
1. Update backend auth config: `auto_confirm_email = true` (also keep signups enabled, anonymous off, HIBP password check on).
2. Verify the existing register flow in `src/routes/auth.tsx` works without changes (it already navigates straight to `/` after sign-up, which will now succeed since no confirmation is required).

### Do you need to copy/paste anything?
**No.** This is a backend setting toggle — I apply it directly. Nothing for you to paste into Supabase, Vercel, or GitHub. New sign-ups will work instantly after the change is approved.

### Note on existing unconfirmed users
Anyone who already registered but never confirmed their email will stay stuck until they're manually confirmed. If you have any test accounts in that state, tell me and I'll give you a one-line SQL snippet to confirm them.
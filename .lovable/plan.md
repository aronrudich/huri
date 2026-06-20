## Goal
Move Huri off Lovable Cloud and onto a Supabase project you own, so all data and auth runs on your account (no Lovable Cloud usage) and your Vercel deployment becomes the source of truth.

## What you'll do (manual)
1. **Create a new Supabase project** at supabase.com (free tier is fine).
2. **Open the SQL Editor** → paste the single SQL block I provided in chat above → Run. This creates every table (`roles`, `profiles`, `messages`, `parked_cars`, `pickup_requests`, `push_subscriptions`), the `directory` view, all RLS policies, triggers, the `is_manager` and `archive_stale_pickups` functions, and seeds the 10 Jeep/Chrysler/Dodge demo cars with 2 blocked pickup requests.
3. **Enable auth providers** in your new Supabase → Authentication → Providers: turn on Email, and Google (paste your Google OAuth client ID + secret).
4. **Copy keys** from Supabase → Project Settings → API.
5. **In Vercel → Settings → Environment Variables**, set/replace:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = anon / publishable key
   - `SUPABASE_URL` = same Project URL
   - `SUPABASE_PUBLISHABLE_KEY` = same anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role key (keep secret)
6. **Redeploy on Vercel** so the new env vars take effect.

## What I'll do in Lovable
Nothing in this plan — no file edits needed. The app code already reads from `VITE_SUPABASE_*` env vars, so swapping the values in Vercel is all that's required for the Vercel deployment to point at your Supabase.

## Important consequences
- Once Vercel points at your Supabase, **I (Lovable) cannot reach that database**. Any future schema or data change you ask for will be delivered as SQL you paste into your Supabase SQL Editor yourself.
- The Lovable preview (`huri.lovable.app`) will keep using Lovable Cloud's database — it'll be a separate environment from your Vercel site. If that's confusing, you can either stop using the Lovable preview, or also point the Lovable `.env` at your Supabase (I can help with that in a follow-up).
- Push notifications: VAPID keys live in code/env and will continue working regardless of which database you're on.

## Next step after approval
Switch back to build mode and follow the 6 manual steps above. Ping me once Vercel is redeployed and I'll help verify the cars and messaging work against your new database.

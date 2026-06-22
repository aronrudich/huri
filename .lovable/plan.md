## What happened

Your earlier run partially succeeded — the `roles` table got created, then something else failed, leaving the database half-built. Re-running the same script now fails on `CREATE TABLE public.roles` because it already exists.

Supabase's AI suggested `CREATE TABLE IF NOT EXISTS`. That would skip the error but leave you with a broken half-built schema (missing columns, missing policies, no data). Not what you want.

## The fix

Run a clean reset first, then re-run the full setup. Since you have no real data yet, it's safe to drop everything in the `public` schema and start fresh.

I'll give you **one single SQL block** to paste into the Supabase SQL Editor that:

1. Drops every Huri table, function, and type from your previous partial run (safe — no real data yet).
2. Recreates all 6 tables (`roles`, `profiles`, `parked_cars`, `pickup_requests`, `messages`, `push_subscriptions`).
3. Re-adds all GRANTs, RLS policies, triggers, and the `is_manager` / `archive_stale_pickups` functions.
4. Re-seeds the 10 demo cars and 2 demo pickup requests.

You paste it once → Run → done. If it ever fails partway again, you can just re-run the same block (the drops at the top make it idempotent).

## After you run it

Same remaining steps as before:
- Enable Email + Google auth providers in your new Supabase project
- Set the 5 env vars in Vercel (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- Redeploy on Vercel

Approve this plan and I'll paste the full reset+setup SQL block in the next message.

## What's actually wrong

Your Vercel project still has the env vars from the old Next.js version of Huri (`NEXT_PUBLIC_SUPABASE_*`, `POSTGRES_*`, etc.). The new TanStack Start code (what Lovable is now generating and pushing to GitHub) reads **different** variable names. So on `huri1.vercel.app`:

- The browser Supabase client doesn't know which project to call, or uses a stale fallback.
- The server functions (which is what loads the People list in Compose) have no `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`, so they silently fail.
- Result: empty People list, and anything that depends on server functions misbehaves. The "2 cars" you see is the pickup queue (which goes through the plain browser client, so it half-works).

Meanwhile, on the Lovable preview, all the data IS there:
- 16 active employee profiles
- 10 fake parked cars (T1001–T1010)
- 2 active pickup requests

So this is purely a Vercel configuration problem, not missing data and not a code bug.

## Step 1 — Confirm Vercel is pointed at the Lovable Cloud database

In Vercel → Project → Settings → Environment Variables, click "Reveal" on `NEXT_PUBLIC_SUPABASE_URL`. It must start with:

```
https://qlkxeysveduewuxrvoyd.supabase.co
```

- If it matches: good, the database is the same one Lovable is using. Continue to Step 2.
- If it points at a different project: that's the old Next.js database. We need to delete those old vars and use only the Lovable ones in Step 2. Tell me what you see and I'll guide you.

## Step 2 — Add the five env vars TanStack actually reads

In Vercel → Project → Settings → Environment Variables, add these for all environments (Production, Preview, Development). The values are the same ones already in your Lovable Cloud `.env`:

| Name | Value source |
|---|---|
| `VITE_SUPABASE_URL` | `https://qlkxeysveduewuxrvoyd.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | (same publishable key Lovable uses) |
| `SUPABASE_URL` | `https://qlkxeysveduewuxrvoyd.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | (same publishable key) |
| `SUPABASE_SERVICE_ROLE_KEY` | (service role key — server-only, never exposed to browser) |

I'll give you the exact values to paste once you confirm Step 1. The publishable key is safe to share, but the service-role key must stay server-only — only paste it into Vercel env vars, never into the codebase.

The old `NEXT_PUBLIC_SUPABASE_*` and `POSTGRES_*` vars can stay or be deleted; the new code doesn't read them either way. Cleaner to delete them so nobody gets confused later.

## Step 3 — Redeploy

In Vercel → Deployments → latest deployment → ⋯ menu → **Redeploy** (uncheck "use existing build cache"). Env-var changes only take effect on a fresh build.

After redeploy, hard-refresh `huri1.vercel.app`, sign in, and open Compose. You should see all 15 other employees under People, and the Pickup screen should behave the same as on the Lovable preview.

## Step 4 — Keep Lovable and Vercel in sync going forward

This is already wired up:
- Lovable pushes code → GitHub → Vercel auto-deploys.
- Lovable migrations push to GitHub → Supabase auto-applies (same DB Vercel reads).

So once Step 2 is done once, nothing more is needed. Future schema/UI changes flow through automatically.

## Step 5 (optional cleanup) — Point huri1.vercel.app at the published Lovable app instead

If you'd rather not maintain two deployments at all, you can:
1. Delete the Vercel project entirely.
2. In Lovable → Project Settings → Domains, connect `huri1` (or a custom domain) directly to the published Lovable URL.

Then there's only one deploy target. Up to you — say "do the cleanup route" and I'll spell out exactly how, or "stick with Vercel" and we'll stop after Step 3.

---

**Technical notes (for reference, skip if not interested)**

- The TanStack Start template reads `VITE_*` for browser code (Vite bakes them in at build time) and `SUPABASE_*` for server-only code (read at request time). Next.js's `NEXT_PUBLIC_*` convention doesn't apply here — Vercel doesn't auto-translate.
- `SUPABASE_SECRET_KEY` (which you already have) is likely the same value as `SUPABASE_SERVICE_ROLE_KEY` — Vercel/Supabase recently renamed it. Easiest is to add a new var named `SUPABASE_SERVICE_ROLE_KEY` with the same value; that's what the Lovable-generated code imports.
- `POSTGRES_URL` / `POSTGRES_PRISMA_URL` are Prisma leftovers from the Next.js app; the new code uses the Supabase JS client, not Prisma, so they're unused.

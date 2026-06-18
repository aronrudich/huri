# Three things to handle

## 1) Why Vercel shows 404 NOT_FOUND (and the fix)

Your build succeeded (✓ built in 6.18s, Status: Ready) — that's good. The "chunk size" line is just a warning, ignore it.

**The real problem:** This app is built with TanStack Start, which needs a server runtime. By default it builds for **Cloudflare**, not Vercel. Vercel ran the build, got Cloudflare-shaped output, found no static `index.html`, and serves 404 for every URL.

**Fix — do this in Vercel (takes ~2 minutes):**

1. Open your `huri` project on Vercel → **Settings** (top tab) → **Environment Variables** (left sidebar).
2. Click **Add New**. Fill it in exactly:
   - **Key:** `NITRO_PRESET`
   - **Value:** `vercel`
   - **Environments:** check all three (Production, Preview, Development)
3. Click **Save**.
4. Go to **Deployments** tab → click the **⋯** (three dots) on the latest deployment → **Redeploy** → uncheck "Use existing build cache" → **Redeploy**.
5. Wait ~30 seconds. The deployment URL should now load Huri instead of 404.

**While you're in Environment Variables, also confirm all of these are set** (from the `ENV_VARS_FOR_VERCEL.txt` I gave you earlier). If any are missing, add them the same way — and they must point to **your new Supabase project**, not Lovable's:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

After saving any new env vars → redeploy again (env changes only take effect on a new deploy).

---

## 2) "Can I keep using Lovable to update Huri after the transfer?"

**Yes — and it's automatic. Here's how the chain works once GitHub is connected:**

```
You chat with Lovable → Lovable commits to GitHub → Vercel auto-deploys
```

You don't push anything manually. Every edit I make is pushed to your GitHub repo within seconds, and Vercel watches that repo and rebuilds the live site every time. You just refresh huri.com (or your Vercel URL) a minute later.

**Database changes** (new tables, columns, policies) are the one exception — Lovable can't push those to your new Supabase automatically. When I make a database change, I'll give you the SQL to paste into your Supabase SQL Editor (same way we did the initial migration).

So your day-to-day workflow stays identical to today.

---

## 3) Profile page — edit account info

I'll add an **Edit Profile** section to `/profile` with:
- **Full name** — editable, updates `profiles.full_name`
- **Nickname** — editable, updates `profiles.nickname`
- **Phone** — editable, updates `profiles.phone`
- **Email** — editable, uses `supabase.auth.updateUser({ email })` (sends confirmation email to new address)
- **Password** — "Change password" button, uses `supabase.auth.updateUser({ password })` with a new-password + confirm-password form
- **Role** — **view-only for normal users**. Only General Managers can change another user's role (done from the Active Roster section, not on your own card). Letting anyone change their own role = instant privilege escalation.

UI pattern: a "Edit" button on the profile card opens a modal/sheet with the form. Save button writes to Supabase and shows a toast.

No database changes needed — all columns already exist.

---

## What I'll do in build mode
- Add `EditProfileSheet` component (form + save logic) and wire an Edit button onto the profile card in `src/routes/profile.tsx`.
- Add a "Change role" action on each roster row visible only to General Managers, with a small role picker (Manager / Director / Service Advisor / Porter — whatever roles you already use).

Everything in section 1 and 2 above is for you to do in Vercel/understand — no code changes from me are needed for those.

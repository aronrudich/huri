# Goal

Make it so every database change flows automatically:
**Edit SQL in your repo → push to GitHub → Supabase applies the migration → Vercel redeploys with the new types.**

No more pasting SQL into the Supabase dashboard.

---

## What you already have

- GitHub repo `aronrudich/huri` connected to Supabase ✅
- GitHub repo connected to Vercel (auto-deploys on push to `main`) ✅
- Supabase env vars synced to Vercel ✅
- Working directory in Supabase integration set to repo root ✅

## What's missing

- A `supabase/migrations/` folder in the repo containing your current schema as a migration file. Without it, Supabase has nothing to apply when you push.

---

## Exact steps

### Step 1 — Save the SQL you already ran as a migration file

In your repo, create this file:

```
supabase/migrations/20260622000000_initial_schema.sql
```

Paste the **exact same SQL block** I gave you earlier (the reset + setup one you ran in the Supabase SQL editor) into that file.

Filename rule: must start with a UTC timestamp `YYYYMMDDHHMMSS_` then a description. Supabase applies them in filename order.

### Step 2 — Mark it as already applied (one-time only)

Because you already ran this SQL manually in Supabase, you don't want Supabase to run it a second time. Tell Supabase "this migration is done":

In the Supabase SQL editor, run once:

```sql
insert into supabase_migrations.schema_migrations (version, name, statements)
values ('20260622000000', 'initial_schema', array[]::text[])
on conflict do nothing;
```

(Use the same timestamp you used in the filename.)

### Step 3 — Commit and push

```
git add supabase/migrations/
git commit -m "chore: baseline migration"
git push origin main
```

Supabase sees the file, checks its `schema_migrations` table, sees `20260622000000` is already applied, skips it. Vercel redeploys. Nothing breaks.

### Step 4 — From now on, the workflow is

For every future schema change:

1. Create a new file `supabase/migrations/<new-timestamp>_<description>.sql`
2. Write only the **delta** (e.g. `alter table profiles add column phone text;`)
3. `git push`
4. Supabase auto-applies it. Vercel auto-redeploys.

Never edit an old migration file. Never run SQL in the Supabase dashboard again — always do it through a migration file.

### Step 5 — Optional but recommended: enable preview branches

In Supabase → Integrations → GitHub, toggle **"Supabase branching"** on. Then every GitHub pull request gets its own throwaway database with your migrations pre-applied, so you can test schema changes before merging to `main`.

---

## What I can do for you

If you want, switch me to build mode and I will:
- Create `supabase/migrations/20260622000000_initial_schema.sql` with the full SQL block
- Give you the exact one-line `INSERT` to paste into Supabase to mark it applied
- You then just `git push` (or let Lovable's GitHub sync push it for you automatically)

Want me to proceed?

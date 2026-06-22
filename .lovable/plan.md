## Goal

Make Lovable the single source of truth for Huri — code, hosting, database, and deployments. Stop maintaining the separate Vercel deployment. Keep GitHub connected as a passive backup/export path.

## What changes

1. **Lovable becomes the production host**
   - Publish the current Lovable project to `huri.lovable.app`.
   - All future code and schema changes flow through Lovable → GitHub → Supabase automatically.
   - Vercel is no longer the target; it can be left idle or deleted later.

2. **Database stays on Lovable Cloud**
   - The existing `qlkxeysveduewuxrvoyd` Supabase project (managed by Lovable) already has the correct schema and seed data.
   - No migration of data to the old Vercel-connected project (`ffvwtcshcvqlelniwlhe`) is needed.

3. **GitHub connection is kept**
   - Lovable continues to push code changes to `aronrudich/huri`.
   - This preserves the ability to self-host later or collaborate with a developer.
   - No action needed on GitHub.

4. **Custom domain (optional, but recommended)**
   - If you want `huri1.vercel.app` to keep working for users, the cleanest path is:
     - Connect your custom domain (e.g. `huri.com`) in Lovable → Project Settings → Domains.
     - Or, if you own `huri1.vercel.app` is not actually a domain you control — Vercel owns `vercel.app`.
   - Since `huri1.vercel.app` is a Vercel subdomain, you can't point it at Lovable. If users/bookmarks rely on it, communicate the new Lovable URL or connect a real custom domain.

## What we do now

1. Publish the Lovable project to `huri.lovable.app`.
2. Verify the published site shows all 16 employees under People and the 10 cars in Pickup.
3. Optionally connect a custom domain if you want something cleaner than `huri.lovable.app`.

## What you do later (no urgency)

- Delete the Vercel project whenever you're comfortable. It won't affect Lovable.
- Stop thinking about `ffvwtcshcvqlelniwlhe` — it's orphaned and unused.

## What we don't touch

- No code changes needed.
- No database migrations needed.
- No env-var changes inside Lovable.

# Get huri.lovable.app working again (and keep huri.team for new dealerships)

## What actually happened

Nobody was logged out. When huri.team was connected, it was set as the **primary** address. With a primary set, every other address — including huri.lovable.app — automatically forwards to it.

So a phone that opened huri.lovable.app was sent over to huri.team. Phones remember a login per address, and huri.team is a different address, so it showed the sign-in screen. The saved login on huri.lovable.app was never deleted — it is still on each phone, waiting.

## The fix (one setting, you do it — I can't change it)

Project Settings → Domains → open the three-dot menu (...) next to **huri.team** → **Unset as primary**.

After that, no address forwards anywhere:

- huri.lovable.app serves Huri at its own address again. Everyone who was already signed in there will be signed in again the next time they open it — nothing for them to do, no password needed.
- huri.team keeps working exactly as it does now, so new dealerships can use it.

Both addresses run the same Huri and the same data, so it does not matter which one a person uses.

## One thing to know going forward

A login is remembered per address. Someone who signs in on huri.team is not automatically signed in on huri.lovable.app, and the other way around. That's fine for your plan (existing people stay on huri.lovable.app, new dealerships start on huri.team), but if someone switches addresses they will sign in once on the new one.

## What I'll do

No code changes are needed for this. Once you've unset the primary, tell me and I'll confirm both addresses serve Huri directly and that the sign-in screen no longer appears for existing phones.

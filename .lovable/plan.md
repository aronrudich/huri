## Short answer

Huri's own code is in good shape — all 30-ish app files are real, used, and reasonably organized. What isn't polished is the **scaffolding around it**: starter-template files that were never used, 44 unused UI component files, unused libraries, and one leftover setting from the Vercel/GitHub experiment. None of it slows Huri down at runtime today, but it bloats the download file you keep asking for and makes the code look messier than it is.

Nothing below changes a single screen, button, notification, or database rule. It only deletes files no screen imports.

## What I found (verified against the code)

**1. Unused UI library files — 44 of 46**
Huri only uses two of the pre-installed shadcn components (`sonner` for toasts, `switch` for the notification toggle). The other 44 — calendar, carousel, charts, sidebar, pagination, menubar, command palette, OTP input, etc. — are never imported by any Huri screen.

**2. Unused npm libraries**
Chart, calendar, carousel, drawer, resizable-panel, OTP and form libraries are only referenced by those unused UI files. Removing both together is safe; removing only one side is not.

**3. Leftover starter example**
`src/lib/api/example.functions.ts` and `src/lib/config.server.ts` are template demo files ("Hello, Ada!") that nothing calls.

**4. Leftover from the Vercel experiment**
`vite.config.ts` still sets the build target to `vercel`. Huri now runs on Lovable's own hosting, so this line is stale. This is the only change with any real risk, so I'll do it last and confirm the app still builds and loads before keeping it. If anything looks off, I revert that one line and keep everything else.

**5. The `remotion` folder (2.7 MB)**
A separate promo-video project (phone mockups, scene animations) that isn't part of the Huri app at all. It's dead weight in the download file, but it's *your* marketing asset — I'll leave it alone unless you tell me to strip it.

## What I will NOT touch

- Any route, form, notification, lot/blocking logic, roster, messaging, or approval code
- Database tables, policies, or cron jobs
- Branding, logo, colors, layout, or spacing
- Push notification setup (working — leaving it exactly as is)

## Plan

1. Delete the 44 unused UI component files; keep `sonner` and `switch`.
2. Remove the npm libraries that only those deleted files used.
3. Delete the two starter template files.
4. Remove the stale `vercel` build target from `vite.config.ts`.
5. Verify: full build, then load the inbox, pickup list, park form, lot tabs, a message thread, and profile in a real browser to confirm everything renders and works identically.
6. Produce a fresh single downloadable file with the entire cleaned Huri code.

### Technical notes

- Files removed: `src/components/ui/*` except `sonner.tsx` and `switch.tsx`; `src/lib/api/example.functions.ts`; `src/lib/config.server.ts`.
- Dependencies removed: `recharts`, `embla-carousel-react`, `react-day-picker`, `input-otp`, `cmdk`, `vaul`, `react-resizable-panels`, `react-hook-form`, `@hookform/resolvers`, plus the Radix packages only those files import. `date-fns`, `zod`, `sonner`, `lucide-react`, `web-push`, Supabase and TanStack packages all stay — Huri uses them directly.
- `vite.config.ts`: drop the `nitro: { preset: "vercel" }` block so the default Lovable target applies.
- Expected effect: smaller download and faster builds; identical runtime behavior.

## One question

Should the `remotion` promo-video folder stay in the download, or be split out? Say the word either way — default is to keep it. No, you can get rid of the promo video.
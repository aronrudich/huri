Bundle the entire Huri source tree into a single plain-text file you can download and upload to Claude as one attachment.

## What goes in the bundle
- All app source: `src/**` (routes, components, lib, integrations, styles)
- Public assets that are code-like: `public/sw.js`, `public/manifest.webmanifest`
- Config files: `package.json`, `vite.config.ts`, `tsconfig.json`, `components.json`, `eslint.config.js`, `bunfig.toml`, `.prettierrc`
- Backend: every file under `supabase/migrations/**` and `supabase/config.toml`
- Server entry: `src/server.ts`, `src/start.ts`, `src/router.tsx`
- Remotion explainer-video project: `remotion/src/**` and `remotion/package.json`

## What is excluded (and why)
- `node_modules/`, `bun.lock`, build output — not source, massive, useless to a reviewer
- `src/routeTree.gen.ts` and `src/integrations/supabase/types.ts` — auto-generated
- `.env` and any secret files — never paste keys into another tool
- Binary assets (images, video, fonts)

## Output format
One file: `/mnt/documents/huri-full-code.txt`

Each file in the bundle is wrapped like this so Claude can tell them apart:

```text
================================================================
FILE: src/routes/pickup.tsx
================================================================
<file contents>
```

A short header at the very top lists the project stack (TanStack Start + Supabase + Tailwind v4) and the file count, so whoever reviews it has context.

## How you'll get it
After it's generated I'll surface it as a downloadable artifact in chat — one click to download, then drag-and-drop into Claude.

## Technical notes
A small Node script walks the directories above, skips the excluded paths, and concatenates everything with the header format. Expected size: roughly 1–3 MB of text, which Claude (Sonnet/Opus with large context, or Claude Projects) can ingest as a single attachment.
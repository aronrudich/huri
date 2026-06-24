## What I'll build

A ~50-second downloadable MP4 explainer video for Huri, built with Remotion (motion graphics + mock Huri UI), narrated with an ElevenLabs AI voiceover and synced on-screen captions. The video is **not** added to the app — it's saved to `/mnt/documents/huri-explainer.mp4` so you can download and share it.

## Creative direction

- **Aesthetic:** Clean, modern, "Tech Product" — matches Huri's existing iOS-style mobile look.
- **Palette:** Huri blue primary `#2F6BFF`, near-black surface `#0B1220`, soft surface `#F5F7FB`, accent amber `#F5A524` for the "blocked / nonstarter" beat.
- **Type:** Inter for UI mocks (matches app), Space Grotesk for big display titles.
- **Motion system:** Snappy spring entrances (damping 18), subtle parallax on phone mocks, wipe transitions between scenes.

## Narration script (~50s, ~120 words)

1. "Meet Huri — the all-in-one app for service drives."
2. "Send a direct message to anyone on the team, or broadcast to an entire role — service, sales, valets, managers."
3. "When a car comes in, park it in seconds. Just enter the RO number and the spot."
4. "When a customer arrives, advisors fire off a pickup request with one tap. Every valet gets notified instantly."
5. "Huri shows the spot, flags nonstarters, and warns if the car is blocked in — so valets move the right cars in the right order."
6. "Faster pickups. Less chaos. Happier customers. That's Huri."

## Scenes (each ≈ 6–9s)

1. **Logo hook** — Huri wordmark drops in, tagline fades up.
2. **Messages** — phone mock of Inbox + role broadcast chip animating in.
3. **Park** — phone mock of Park form, RO# and Spot# fields fill themselves.
4. **Pickup request** — Advisor view → push notification appearing on a valet phone.
5. **Pickup queue with warnings** — pickup card showing "Note: dead battery" and "Blocked by Spot 4" highlights.
6. **Outro** — tagline + URL `huri.lovable.app`.

## Technical approach

- Scaffold Remotion project at `remotion/` per the video-creator skill (bun install, musl compositor swap, ffmpeg symlinks).
- Compositions: 1920×1080, 30 fps, ~1500 frames.
- One scene per file under `remotion/src/scenes/`, wired with `<TransitionSeries>` + `wipe`/`fade`.
- **Voiceover:** generate once via Lovable AI Gateway TTS (`openai/gpt-4o-mini-tts`, voice `alloy`, mp3) using the `ai-gateway` skill script, save to `remotion/public/audio/vo.mp3`, mount via `<Audio src={staticFile(...)} />`. Total duration is calculated from the audio length so visuals stay in sync.
- **Captions:** per-scene `<Sequence>` of narration lines, animated in with springs, timed to match the script beats.
- Render headlessly via `scripts/render-remotion.mjs` (chrome-for-testing, muted:false since we have audio, concurrency 1).
- Final file: `/mnt/documents/huri-explainer.mp4`, surfaced as a `<presentation-artifact>` for download.

## Out of scope

- No changes to the Huri app itself.
- No in-app video player.
- No multi-language versions (English only for now).

If you want a different voice (e.g. female / British / more energetic), tell me before I build and I'll swap the TTS voice.

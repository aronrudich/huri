# Polished Huri Explainer Video (v2)

A ~2 minute downloadable MP4, rendered with Remotion, narrated by ElevenLabs "Brian" (calm, professional male), with on-screen visuals timed to each script beat. Saves to `/mnt/documents/huri-explainer-v2.mp4`. The existing v1 file stays untouched.

## Polished narration script (~290 words, ~2:00 at calm pace)

1. **Opener (orient the viewer)**
   "Huri is built for dealership service departments — valets, advisors, and technicians, all on one app."

2. **Messages**
   "Huri opens to a message board, like Slack for the service drive. Send a direct message to anyone on the team — or message a whole group: valets, advisors, or technicians. Everyone in the department is reachable, instantly."

3. **Pickup queue (the car tab)**
   "The car tab holds the pickup list. The moment an advisor or a technician submits a pickup, every valet gets a notification on their phone."

4. **Spot, blocking, and the one-trip win**
   "Huri shows the exact spot the car is parked in. And if other cars are blocking it in, Huri shows which cars — by RO number. The lot is laid out three deep: spot one in front, two in the middle, three in back. So spot three can be blocked by one and two. Now the valet grabs every key they need and makes one trip — not three."

5. **Queue ordering and claim flow**
   "The oldest unclaimed pickups float to the top. Tap claim, and the status flips to in progress and drops down the list. Completed pickups disappear automatically, so the queue stays clean."

6. **Top-right buttons: Park and Pickup**
   "Two buttons live in the top-right on every screen. Advisors hit Pickup for customer cars. Technicians hit Pickup to have a car pulled into their bay. Park is for logging a car into its spot — just enter the RO number and the spot number."

7. **Spot 0**
   "Moving a car off the lot but not for a customer? Set the spot to zero. When it comes back, whoever parks it enters the new spot."

8. **Lot tab**
   "The lot tab shows every spot and the car in it. Tap any spot to pull up that car's info or update it."

9. **Profile tab**
   "The profile tab is where each user updates their info — and toggles notifications off when they're not on shift."

10. **The problem Huri solves**
    "Today, customer pickups take too long. Valets wander lot to lot, find the car blocked in, walk back across the street for more keys, then walk back again. Advisors hand-write tickets at the key station. Everyone is constantly hunting each other down."

11. **Closing**
    "Huri turns the pickup list digital. One trip, the right keys, the right car — and a customer who isn't left waiting in the service drive. Huri. Built for the service drive."

## Scenes (matched 1:1 to the narration)

| # | Scene | Length | Visual |
|---|---|---|---|
| 1 | **Intro / opener** | ~7s | Huri logo + tagline "built for dealership service departments" |
| 2 | **Messages** | ~12s | Phone mock of Inbox; group chips (Valets / Advisors / Technicians) animate in |
| 3 | **Pickup notification** | ~9s | Advisor phone submitting pickup → wipe → valet phone with push notification dropping in |
| 4 | **Spot + blocking diagram** | ~17s | Phone mock of pickup card showing "Spot 6 · Blocked by Spot 4, Spot 5" + a clean animated 3x3 row diagram (front/middle/back labeled, arrows showing 1→2→3 blocking). RO numbers visible. |
| 5 | **Queue ordering + claim** | ~12s | Pickup queue with 3 cards; top card animates "Claim" tap, badge flips to "In Progress", card slides down |
| 6 | **Park & Pickup buttons** | ~14s | Phone with the top-right buttons highlighted; quick toggle between Advisor pickup form, Technician pickup form, and Park form (RO + spot fields filling) |
| 7 | **Spot 0** | ~9s | Car icon leaving spot 12 → spot indicator flips to "0 — off the lot" → returns and flips to a new spot |
| 8 | **Lot tab** | ~9s | Scrolling list of spots with cars; tap on a row opens a quick detail card |
| 9 | **Profile** | ~7s | Profile screen with notifications toggle flipping off (grey) then on (blue) |
| 10 | **The problem (today)** | ~15s | Stylized animation: tiny valet figure walking across two lots, finding car blocked, walking back, walking back again — amber accent for "wasted trips" |
| 11 | **Closing** | ~9s | Huri logo + "Built for the service drive" + `huri.lovable.app` |

Total ≈ 120 seconds at 30 fps = 3600 frames.

## Visual system (same look as v1, refined)

- Palette: Huri blue `#2F6BFF`, near-black `#0B1220`, soft surface `#F5F7FB`, amber accent `#F5A524` (used only on the "blocked" + "today's problem" beats).
- Type: Space Grotesk for big display, Inter for UI mocks (already loaded in the v1 project).
- Motion: spring entrances (damping 18), wipe + fade transitions, captions sync each script line.
- All phone mocks use the Huri-branded shell already in `remotion/src/components/Phone.tsx`.
- Pacing tuned for Brian's calm delivery — generous holds on the diagram and the "problem today" scene.

## Technical approach

- Reuse the existing `remotion/` project. Add new scenes in `remotion/src/scenes/v2/` so v1 stays intact.
- New `Root.tsx` composition id: `main-v2` (1920×1080, 30 fps).
- Generate voiceover once via Lovable AI Gateway TTS using ElevenLabs voice `Brian` (`nPczCjzI2devNBz1zQrb`) at speed 0.95 for a calm pace; save to `remotion/public/audio/vo-v2.mp3`.
- Compute total duration from the audio length so visuals stay in sync.
- Render via `scripts/render-remotion.mjs` (chrome-for-testing, concurrency 1, `muted: false`).
- Output: `/mnt/documents/huri-explainer-v2.mp4`, surfaced as a download artifact.

## Out of scope

- No changes to the Huri app itself.
- No in-app video player.
- English only.
- v1 file (`huri-explainer.mp4`) is left in place.

If you want me to swap any wording, change the order, or cut/extend a scene, tell me before I build and I'll adjust.

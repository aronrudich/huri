# Roadmap
- [x] Exclude claims strictly over eight hours through one reporting/scoring gate (including submission credit and custody penalties); preserve history, update milestone counts, and verify 15 tests. Current data has 21 excluded claims; no separate PDF/export calculator exists.
- [ ] Verify signed-in Reports with the eight-hour cutoff; blocked because the requesting user has no matching app account for automatic sign-in.
- [x] Enforce customer arrival service hours on both languages and server writes; verified opening/closing boundaries, disabled controls, and direct closed-hours rejection.
- [x] Business explainer: shared video asset, desktop side-by-side player, mobile full-screen viewing, helper-text removal, and layout/playback verification.
- [x] Replace legacy browser and home-screen icons with the approved wordmark and verify the served files.

- [x] Fix history attribution: automated/background moves no longer stamped with a stale `parked_by` user
- [x] History wording: "Requested by" / "Claimed by"
- [x] Customer pickups and stages clear the car's old notes; only a note typed at submission is kept
- [x] Same note-clearing for wash submissions
- [x] Any submission (pickup, stage, wash, parts, park) for an unknown RO now creates the car at UNKNOWN
- [x] Code cleanup: removed retired shuttle history branch, fixed Hook-naming lint error in sign-in, typed message inserts and hidden-thread queries, replaced the silent catch on the owner signup notice

## Six-update batch (Oct 2026)
- [x] New logo everywhere + icons
- [x] Merge advisor pickup into active ETA request
- [x] Shop Foreman reports
- [x] Company settings restricted to reporting management
- [x] Help tab (anonymous support, email + push to Aron)
- [x] robots.txt

## Business onboarding (in progress)
- [x] Stage 1: Business tab, saved inquiries, email to Aron, Business Onboarding inbox
- [x] Stage 2: secure onboarding links + onboarding email (wizard step 1: business details)
- [x] Stage 3: map wizard — no-key maps: OpenStreetMap standard + Esri World Imagery satellite, Nominatim address search; property/lots/rows/spots, auction barcode info
- [x] Stage 4: Aron's map review/edit, request changes, activity log, "Approve and Create Company" (atomic, permanent code), activation email
- [ ] Stage 5: company-specific maps in daily use (maps are saved per company; daily screens still use JCD's SV/CP/BL layout)

- [x] Business-facing map wizard replaced with a short intake (business info + address with live lookup). Property mapping is now done by Huri Support in the private review tool after talking with the business.
- [x] Thank-you popup copy: "Thank you!" / "We've received your information." / "We will contact you in a Huri" (primary), remove footnote and subtext, backdrop-close

## NAA lot-map sandbox
- [x] Private `/lot/naa-preview` test page with all 588 mock stalls, five zones, pan/zoom, search, filters, vehicle details, and tandem-blocker previews
- [x] Keep the sandbox frontend-only and isolated from JCD's `/lot`, company data, onboarding, and permanent company code

## Pickup list (Oct 15)
- [x] Own active submissions pinned at top with "Your submissions" divider (submitter's screen only)
- [x] Claimed pickups stay 60 minutes before automatic removal (schedule unchanged)

## Stale phones
- [x] Open apps check for a newer published version and reload themselves (not while typing or with a sheet open); version shown on Profile

## Pickup archive and install popup (Oct 20)
- [x] Remove browser auto-archiving; retain company-specific display timing; verified JCD's 60-minute server archive and every-minute schedule. Eleven tests pass and build OK.
- [x] Remove the iOS install popup; verified iPhone sign-in and registration, and signed-out pickup redirect.
- [ ] Verify the signed-in pickup screen; blocked until the requesting user signs in (no matching account available for automatic preview sign-in).

## Outage hardening (Oct 19)
- [x] Database moved from Tiny to Small (Tiny was running out of memory)
- [x] Lists never show "empty" when the server can't be reached; reconnect banner instead
- [x] Staggered retries/reconnects so phones don't all hit the server at once; lot screen patches single cars instead of reloading the whole lot
- [x] Archive and reminder jobs restored to every minute; old job log trimmed daily
- [x] Business page uses explainer video v6

## Messaging removal and simple passwords (Oct 21)
- [x] Bottom bar is exactly 3 tabs (Pickup, Lot, Profile); unread badge and message polling removed; tab prefetcher updated
- [x] /inbox, /compose, /thread/$threadId redirect to /pickup (verified signed-out: they land on sign-in via the pickup guard, never render a messaging screen)
- [x] Password minimum is 6 characters of any kind everywhere (registration, reset, profile change, server signup validator) with helper text; no complexity rules
- [ ] Verify the signed-in bottom bar shows exactly 3 tabs; blocked until the requesting user signs in (no matching account available for automatic preview sign-in)

## Explainer music and clean preview (Oct 19)
- [x] Replace v6 music with a subtle uplifting bed and export/register v7 MP4, WebM, and poster; identical video packets, measured music 19.9 dB below speech, and browser playback verified. Listening quality remains unverified because no audio listening tool is available.
- [x] Remove video instructional labels and verify standalone mobile preview, desktop player, and full-screen playback.

## Oct 20 batch
- [x] No install hints anywhere (sign-in and Profile text removed)
- [x] Signed-out visitors go straight to sign-in with no pickup-screen flash
- [x] Reports count and average every claim (no 20-minute cap; "Slowest" shown)
- [x] Tech pickups no longer exempt a car left in the bay from the −2 unlogged deduction
- [x] Explainer v8 (intro card + ETA privacy line) on the Business tab

## Unified narration revision (abandoned)
- [x] v8/v9/v10 unified-narration attempts rejected (v10 was "totally different"); the 0:47 ETA privacy addition was abandoned.
- [x] Business tab reverted to approved explainer v7 (v7 MP4/WebM/cover).

## Business onboarding example text (Oct 21)
- [x] Parking-layout note box shows a light-grey multiline example ("Ex. Our dealership has three parking areas:" plus Back Lot 1-120 / Side Lot w/o numbers / Service Lot 1-147) with single line breaks, leading-snug and 6 rows; verified on phone and desktop that no line wraps and there are no blank gaps; clears on typing; 3,000-character cap, required field, and empty-submit blocking verified unchanged.


## QA fix (Oct 22)
- Removed the dead People section from Pickup/Lot search and the retired messaging query code behind it.

## Measured database optimization (Oct 23)
- [ ] Measure project usage, expensive queries, existing indexes, and scheduled work.
- [ ] Apply only evidence-backed performance changes; preserve recovery refreshes, permissions, scoring and all data.
- [ ] Verify query plans/results and relevant regression tests; document measured versus unproven savings. Do not publish.

# Roadmap
## Combined demo, car shortcut and Val restoration (Oct 30)
- [ ] Refine isolated demo sequence, locations, notes, badges and claim flash; verify browser behavior.
- [ ] Add permission-safe car shortcut and per-user dismissal guide; enable one-tap native video fullscreen with fallback.
- [ ] Audit and restore only Val's historical mistaken cancellations; preserve timestamps and newer cancellations.
- [ ] Run regressions and check preview errors; do not publish.

## Public demo refinements (Oct 30)
- [x] Update only the synthetic feed: clean header, semantic request colors, realistic origins/destinations/blockers, multi-brand vehicles and selective notes.
- [x] Verify inert Claim, 3–4-second claims, 1.5-second breather, 30-minute ETA eligibility, and all three auth return links; 45 tests pass and phone/desktop checks pass. No publication or backend changes; ordinary page delivery costs still apply.

## Monitoring findings (Oct 28)
- [x] Keep Pickup live channels stable across pending queries and car updates; ignore intentional channel cleanup statuses.
- [x] Preserve typed RO corrections and the original car identity when opening Park by ID; verify delayed loads cannot reset edits.
- [x] All 41 tests pass, including real-screen regressions with controlled network boundaries; build OK and signed-out pages redirect safely. Resolved only these two findings; no publication or database changes.
- [ ] Signed-in live Pickup and RO-save acceptance: blocked by unavailable requesting-user preview session; controlled screen tests do not certify live employee flows.

## Uploaded master hardening prompt (Oct 28)
- [x] Review the 22 proposals against source and database definitions; the 30-minute claim lead was already correct, and blanket first-signup ownership was rejected.
- [x] Add tenant-scoped profile reads, company-qualified photo uploads with legacy compatibility, paginated collection reads, and scoped realtime patches.
- [x] Add explicit company location rules and management editing, company hours/report boundaries, Support first-owner approval, and atomic ownership transfer.
- [x] Keep owner deletion protection on public.profiles rather than a managed auth-table trigger; normalize assignment positions before occupied-spot checks.
- [x] 39 tests pass; public Ontario arrival language switching preserves RO/query parameters and closed-hour controls; current build OK. No publication performed. Database changes already applied to shared live backend.
- [ ] Signed-in parking, photos, reports, owner approval/transfer and multi-company permission checks: blocked by unavailable requesting-user preview session; these flows are not certified.
- [ ] Final live acceptance of the hardening batch remains blocked by those signed-in checks; this is not an exhaustive bug-free inventory.

## Lot completeness and car details (Oct 27)
- [x] Load every active car with pagination; preserve TAKEN history and live updates, including targeted TAKEN lookups for open pickup context.
- [x] Preserve existing model/notes on location-only saves; restored JCD RO #193626 model to Jeep GC without changing SV 3.
- [x] Auto-load six-digit RO details without replacing user-entered details or selected spot; refresh Lot cache after save.
- [x] 32 regression tests pass; build OK; current database has 719 active cars and 43 occupied SV spots; signed-out Lot safely redirects with no runtime errors.
- [ ] Verify signed-in Park-to-Lot flow and occupied colors; blocked because no app account matches the requesting user for automatic preview sign-in. User must sign in to the preview. Frontend changes not published; database fix already applied.

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
- [x] Measure project usage, expensive queries, existing indexes, and scheduled work; results in database-optimization-report.md.
- [x] Add ordered snapshot and company/RO/date request-history indexes; preserve recovery refreshes, permissions, scoring and all data.
- [x] Verify both indexes, faster same-query plans and identical result checksums; all 26 regression tests pass. No measured credit reduction claimed; no publishing.

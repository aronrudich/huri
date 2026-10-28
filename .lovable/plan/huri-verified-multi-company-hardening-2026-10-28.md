# Huri: verified multi-company hardening

## Goal and limits
Address the uploaded master prompt's 22 items in four controlled batches, preserving JCD's current workflow and keeping each company's data private. Do not publish automatically. Database changes affect the shared live backend immediately, even before publication; use read-only preflight checks and reversible, compatible migrations.

This is not a guarantee that every possible defect has been found or that Huri can never crash. Earlier statements that the issue inventory was complete were not justified. Distinguish confirmed defects, future scaling risks, and already-correct behavior before changing anything.

## Corrections to the uploaded prompt
- **Item 1 is already correct in the live database:** claims open 30 minutes before ETA. Keep that rule and add boundary verification rather than reapply an old migration.
- **Item 10 is not a 20/30-minute regression:** the live archive uses 60 minutes. The remaining issue is ignoring each company's configured duration. Preserve JCD's current 60 minutes.
- **Item 2's proposed simplified policy is too broad:** preserve existing approved/active employee visibility and owner access to their own company's pending employees while removing owners' cross-company access.
- **Item 4's automatic first-signup owner grant is unsafe:** replace it with Huri Support-controlled first-owner provisioning for an explicitly approved company and intended person. Ordinary code-based signups remain pending.
- **Items 7 and 9 must not make every free-text location exclusive:** classify physical single-car spots explicitly; shared areas stay shared. Do not displace cars or modify existing location records as a migration shortcut.
- **Item 13's source is actually the scheduled stale-cars hook**, not the library path cited in the upload. It also combines customer pickup history by RO alone across companies; fix that company/RO attribution together with pagination.
- **Item 20 targets a retired messaging destination that currently redirects**, not a nonexistent route. Send the celebration directly to Pickup without reintroducing messaging or replaying the one-time milestone.
- The upload's photo/flagged/candidate row counts are historical, not verified current counts. Open pickup queries and bounded report loops are not automatically safe merely because they usually return few rows.

## Batch 1 — company isolation and administration
**Items 1–5 and 22**
1. Retain and verify the 30-minute claim window and existing claim authorization.
2. Restrict owner profile reads to their own company without exposing pending/inactive employee records to ordinary employees.
3. Use company/RO/unique-file photo paths. Validate tenant ownership for new paths; authorize legacy originals and thumbnails using actual company-owned photo metadata, not merely absence of another company's RO. Preserve existing photos, private storage, signed links, and spectator write restrictions.
4. Add an authenticated, auditable Huri Support first-owner setup flow tied to a verified intended account. Never grant ownership because someone signed up first or knows a company code. Keep existing employees' sign-in unchanged.
5. Prevent sole-owner deletion; make ownership transfer atomic and fail safely if replacement ownership cannot be established. Preserve normal employee deletion and existing photo retention.
6. Add company-scoped realtime subscriptions and event guards for caches and alerts. Handle DELETE events using known cached IDs and safe refresh behavior when tenant metadata is unavailable. Clear/isolate company-dependent caches on identity/company changes.

## Batch 2 — complete queries without unnecessary downloads
**Items 11–15, plus directly related sibling queries**
1. Page report photos with stable ordering and the existing report date filters; count every qualifying photo once.
2. Page flagged cars and recorded washes, preserving dismissal and checkmark behavior.
3. Batch photo index RO filters in groups of 100 and paginate each batch. Include single-RO photo reads where the same cap can omit history. Preserve thumbnail-first loading and full-size viewing on demand.
4. Page stale-car candidates, company settings and relevant pickup-history reads. Exclude TAKEN candidates as requested; use company/RO keys, not globally shared RO keys. Batch updates and recheck eligibility before writing so a newly moved car is not flagged from an old snapshot.
5. Page open pickup and lot pickup-context lists as well: their status filters reduce rows but do not remove the response ceiling. Replace silent 50,000/200,000 report loop cutoffs with complete traversal or explicit incomplete-report errors, never apparently complete partial totals.
6. Preserve recovery refreshes, cancellation, personal submission ordering, and history. Surface failed pages as failures rather than replace cached lists with partial results.

## Batch 3 — location integrity and scheduled behavior
**Items 6–10**
1. Validate positive numbered spots and the existing 60-character location limit without imposing JCD's 147 ceiling on other stores.
2. Introduce tenant-owned physical-spot/capacity classification, shared-area classification, and explicit blocking relationships. Keep JCD's 147-spot layout and existing blocking rules unchanged.
3. Use the same physical-spot classification for collision warnings, confirmed displacement, and database uniqueness. Inspect duplicate occupancy before changing indexes; stop and report conflicting data rather than silently overwrite it. Serialize concurrent assignments safely.
4. Record requested wash completions when an authorized Car Wash employee moves from WASH to an eligible physical/staging destination; exclude WASH, TAKEN and UNKNOWN and automated moves. Retain tenant and role checks and prevent duplicate wash credit.
5. Archive claimed requests using each company's configured claim-hide minutes. Only the scheduled database job persists completion; no browser auto-completion and no second archive schedule.

## Batch 4 — company configuration and customer screens
**Items 16–21**
1. Add validated company service hours, reporting shift boundary, and RO format settings editable only by authorized management. Defaults retain JCD's six-digit ROs, current schedule, timezone and reporting boundaries. Other companies can opt into the requested 3–10-character letters/digits/hyphen/underscore format.
2. Apply one shared schedule validator to both customer languages and server arrival writes. Opening and closing minutes remain inclusive; invalid times and arrived-now remain disabled with the existing bilingual closure notice.
3. Use company timezone and shift boundary for every report grouping/filter/window and stale-car schedule. Test daylight-saving transitions. Ensure scheduling reaches every configured timezone without increasing job frequency unnecessarily.
4. Connect approved company lot definitions to daily Lot, location selection, pickup map links and blocker scoring. Do not activate experimental previews or require mapping for text-code workflows. JCD retains its existing map; other stores never receive JCD's map as an unexplained fallback.
5. Apply the configured RO rules consistently to forms, dynamic lookups, arrival links, photos and server writes. Preserve historical identifiers and avoid case/normalization collisions.
6. Send milestone notifications directly to Pickup. Add English/Spanish arrival switches preserving slug, RO and all relevant query parameters.

## Technical approach
- Follow existing TanStack server functions, private-bucket storage, authenticated authorization helpers, semantic design tokens and controls.
- Apply schema/function/policy changes only through migration tools, recording exact SQL in the repository. Include grants, RLS, validation and least privilege for new public tables. Never weaken security to resolve an error.
- New privileged ownership assignments belong in protected role storage; do not introduce user-editable role flags. Maintain compatibility with existing authorization through a tested transition rather than a blanket role rewrite.
- Reuse shared paging and pure validators; order paginated reads deterministically and bound outbound concurrency. Preserve company/RO/history and snapshot indexes.
- Update architecture rules and roadmap as approved batches are completed. Inspect affected content-route metadata, including Index, without unrelated visual redesign.

## Verification and release gate
- Add concrete regression tests for each changed rule: 30-minute claim boundaries; tenant profile/storage/realtime isolation with duplicate ROs; unauthorized first-owner setup; pending and spectator writes; last-owner deletion; more than 1,000 rows; page errors; cross-company stale history; custom/shared spots and concurrent occupancy; wash transitions; configurable archive durations; hours/timezones/DST; RO formats and language parameter preservation.
- Keep the existing eight-hour report cutoff, submission credit, custody-attributed deductions, no double penalties and automated-move exclusions unchanged; run their existing regression suites.
- Test signed-in Park → Save → Lot, pickup claim/cancel and report totals through the running UI, plus desktop/phone customer arrival pages. Test a second isolated company/account without modifying JCD operational records. Report any authenticated checks that cannot be performed as unverified.
- Confirm clean build diagnostics, preserved record counts/history and relevant database security checks after each batch. Document actual measured query improvements; do not promise credit savings or dealership capacity without measurements.
- Do not publish automatically. Present completed fixes, remaining blockers and verification results before a separate release decision.
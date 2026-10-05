# Roadmap

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
- [ ] Thank-you popup copy: "Thank you!" / "We've received your information." / "We will contact you in a Huri" (primary), remove footnote and subtext, backdrop-close

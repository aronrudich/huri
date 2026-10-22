# Architecture rules
- Use the shared report eligibility predicate before request-based statistics and scoring, including custody lookbacks; this keeps totals, rankings and downstream exports consistent without changing operational history.
- Generate public browser and install icons from the approved wordmark and version their URLs together; this keeps cached icons consistent with the in-app brand.

- Keep experimental company lot previews in isolated frontend-only routes with deterministic mock data until explicit activation; this prevents test layouts from affecting live tenant data or established company maps.
- Keep public customer-arrival writes inside validated server functions scoped by company slug and RO; this prevents one company link from affecting another company's requests.
- Share the pure service-hours validator between customer arrival pages and server writes; this prevents different operating-hour rules across languages or direct requests.
- All Business-page explainer players share one CDN asset pointer and poster; this keeps replacements consistent without oversized repository videos.
- Only the scheduled database archive completes expired pickup requests; browser timers may filter display but must not persist completion, so devices cannot race the company archive rule.- Unlogged-location deductions come only from the shared custody rules in src/lib/unlogged-custody.ts; this keeps one deduction per missed spot across every report.

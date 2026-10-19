# Architecture rules
- Generate public browser and install icons from the approved wordmark and version their URLs together; this keeps cached icons consistent with the in-app brand.

- Keep experimental company lot previews in isolated frontend-only routes with deterministic mock data until explicit activation; this prevents test layouts from affecting live tenant data or established company maps.
- Keep public customer-arrival writes inside validated server functions scoped by company slug and RO; this prevents one company link from affecting another company's requests.
- All Business-page explainer players share one CDN asset pointer and poster; this keeps replacements consistent without oversized repository videos.
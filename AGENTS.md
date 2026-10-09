# Architecture rules

- Keep experimental company lot previews in isolated frontend-only routes with deterministic mock data until explicit activation; this prevents test layouts from affecting live tenant data or established company maps.
- Keep public customer-arrival writes inside validated server functions scoped by company slug and RO; this prevents one company link from affecting another company's requests.
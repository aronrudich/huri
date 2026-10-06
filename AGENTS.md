# Architecture rules

- Keep experimental company lot previews in isolated frontend-only routes with deterministic mock data until explicit activation; this prevents test layouts from affecting live tenant data or established company maps.
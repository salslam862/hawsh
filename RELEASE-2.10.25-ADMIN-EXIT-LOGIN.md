# Houshak 2.10.25 — Admin navigation and exit/login

- Admin-only navigation boundary: Home becomes the exit boundary.
- Phone back from admin Home asks for exit confirmation instead of traversing old dashboard history.
- Confirmed exit clears admin local/offline session data and routes to `/admin`, so reopening requires login again.
- Existing admin/customer features are unchanged.
- Admin service-worker cache bumped to v7.

# Houshak 2.10.54 — Asset lifecycle audit

## Added
- Added authenticated `GET /api/admin/assets/lifecycle-audit` for ADMIN, MANAGER, ACCOUNTING, and YARD roles.
- Read-only diagnostics cover multiple confirmed reservations, multiple active storage charges, rental status/reservation mismatches, exited assets with active reservations/storage, and missing or inconsistent lifecycle timestamps.
- Response includes severity totals and issue records; findings are not automatically repaired.
- Audit access is recorded in the audit log.
- Bumped admin/client service-worker caches.

## Validation
Run `npm test`, `node --check src/server.js`, and `node --check public/app.js`. This release does not claim a Railway deployment or production-data validation.
